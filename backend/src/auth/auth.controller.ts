import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

class OtpRequestDto {
  phone: string;
}

class OtpVerifyDto {
  phone: string;
  code: string;
  role: 'CUSTOMER' | 'DEALER';
}

class RefreshTokenDto {
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** Staff / Admin login with username + password */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Request OTP for customer / dealer */
  @Post('otp/request')
  async requestOtp(@Body() dto: OtpRequestDto) {
    return this.authService.requestOtp(dto.phone);
  }

  /** Verify OTP and login */
  @Post('otp/verify')
  async verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyOtp(dto.phone, dto.code, dto.role);
  }

  /** Refresh access token */
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  /** Logout (revoke refresh token) */
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /** Get current user info */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req) {
    return req.user;
  }
}
