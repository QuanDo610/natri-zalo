import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private prisma: PrismaService) {}

  /** GET /me — return full profile based on role */
  @Get()
  async getProfile(@Request() req) {
    const { role, customerId, dealerId } = req.user;

    if (role === 'CUSTOMER' && customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          activations: {
            include: {
              product: { select: { name: true, sku: true } },
              dealer: { select: { code: true, name: true, shopName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });
      return { role, customer };
    }

    if (role === 'DEALER' && dealerId) {
      const dealer = await this.prisma.dealer.findUnique({
        where: { id: dealerId },
      });
      return { role, dealer };
    }

    // ADMIN / STAFF — return user record
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });
    return { role: user?.role, user };
  }

  /** GET /me/activations — customer's own activation history */
  @Get('activations')
  @UseGuards(RolesGuard)
  @Roles('CUSTOMER')
  async getMyActivations(
    @Request() req,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const customerId = req.user.customerId;
    if (!customerId) throw new ForbiddenException('No customer profile linked');

    const where: any = { customerId };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { barcodeItem: { barcode: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activation.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          dealer: { select: { code: true, name: true, shopName: true } },
          barcodeItem: { select: { barcode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: skip ? parseInt(skip) : 0,
        take: take ? parseInt(take) : 20,
      }),
      this.prisma.activation.count({ where }),
    ]);

    return { data, total, skip: skip ? parseInt(skip) : 0, take: take ? parseInt(take) : 20 };
  }
}
