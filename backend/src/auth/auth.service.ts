import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly refreshExpiryDays: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {
    this.refreshExpiryDays = parseInt(this.config.get('REFRESH_TOKEN_DAYS', '30'), 10);
  }

  // ── Staff / Admin login (username + password) ──────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as any,
    };

    const refreshToken = await this.createRefreshToken(null, user.id);

    await this.logAudit('LOGIN', 'User', user.id, user.id, { method: 'password' });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  // ── OTP: request code ──────────────────────────────────────────
  async requestOtp(phone: string) {
    if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) {
      throw new BadRequestException('Invalid Vietnamese phone number');
    }

    // Generate 6-digit code
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate old codes
    await this.prisma.otpCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    await this.prisma.otpCode.create({
      data: { phone, code, expiresAt },
    });

    // TODO: integrate real SMS provider (Zalo ZNS, Twilio, etc.)
    console.log(`[OTP] Phone: ${phone}, Code: ${code}`);

    await this.logAudit('OTP_REQUESTED', 'OtpCode', phone, null, { phone });

    return { message: 'OTP sent', expiresIn: 300 };
  }

  // ── OTP: verify & login ───────────────────────────────────────
  async verifyOtp(phone: string, code: string, role: 'CUSTOMER' | 'DEALER') {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Mark OTP as used
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Find or create UserAccount
    let userAccount = await this.prisma.userAccount.findUnique({
      where: { phone },
      include: { customer: true, dealer: true },
    });

    if (!userAccount) {
      // Auto-create account
      if (role === 'CUSTOMER') {
        const customer = await this.prisma.customer.upsert({
          where: { phone },
          update: {},
          create: { name: phone, phone },
        });
        userAccount = await this.prisma.userAccount.create({
          data: { phone, role: 'CUSTOMER', customerId: customer.id },
          include: { customer: true, dealer: true },
        });
      } else if (role === 'DEALER') {
        // Dealer must already exist
        const dealer = await this.prisma.dealer.findFirst({
          where: { phone, active: true },
        });
        if (!dealer) {
          throw new BadRequestException(
            'No dealer found with this phone number. Contact admin to register.',
          );
        }
        userAccount = await this.prisma.userAccount.create({
          data: { phone, role: 'DEALER', dealerId: dealer.id },
          include: { customer: true, dealer: true },
        });
      }
    }

    if (!userAccount || !userAccount.active) {
      throw new UnauthorizedException('Account is disabled');
    }

    const payload: JwtPayload = {
      sub: userAccount.id,
      phone: userAccount.phone,
      role: userAccount.role as any,
      customerId: userAccount.customerId || undefined,
      dealerId: userAccount.dealerId || undefined,
    };

    const refreshToken = await this.createRefreshToken(userAccount.id, null);

    await this.logAudit('LOGIN', 'UserAccount', userAccount.id, null, {
      method: 'otp',
      role: userAccount.role,
    });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      user: {
        id: userAccount.id,
        phone: userAccount.phone,
        role: userAccount.role,
        customerId: userAccount.customerId,
        dealerId: userAccount.dealerId,
        customer: userAccount.customer,
        dealer: userAccount.dealer,
      },
    };
  }

  // ── Refresh token ─────────────────────────────────────────────
  async refreshAccessToken(token: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { userAccount: { include: { customer: true, dealer: true } } },
    });

    if (!record || record.revoked || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    let payload: JwtPayload;

    if (record.userAccountId && record.userAccount) {
      const ua = record.userAccount;
      payload = {
        sub: ua.id,
        phone: ua.phone,
        role: ua.role as any,
        customerId: ua.customerId || undefined,
        dealerId: ua.dealerId || undefined,
      };
    } else if (record.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
      if (!user || !user.active) throw new UnauthorizedException('User disabled');
      payload = {
        sub: user.id,
        username: user.username,
        role: user.role as any,
      };
    } else {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    const newRefreshToken = await this.createRefreshToken(
      record.userAccountId,
      record.userId,
    );

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: newRefreshToken,
    };
  }

  // ── Logout (revoke refresh token) ─────────────────────────────
  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token, revoked: false },
      data: { revoked: true },
    });
    return { message: 'Logged out' };
  }

  // ── Private helpers ────────────────────────────────────────────
  private async createRefreshToken(
    userAccountId: string | null,
    userId: string | null,
  ): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiryDays);

    await this.prisma.refreshToken.create({
      data: {
        token,
        userAccountId,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  private async logAudit(
    action: string,
    entity: string,
    entityId: string | null,
    userId: string | null,
    metadata?: any,
  ) {
    await this.prisma.auditLog.create({
      data: { action, entity, entityId, userId, metadata },
    });
  }
}
