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

@Controller('dealer/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DEALER')
export class DealerMeController {
  constructor(private prisma: PrismaService) {}

  /** GET /dealer/me — dealer's own profile */
  @Get()
  async getProfile(@Request() req) {
    const dealerId = req.user.dealerId;
    if (!dealerId) throw new ForbiddenException('No dealer profile linked');

    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
    });
    return dealer;
  }

  /** GET /dealer/me/stats — dealer dashboard stats */
  @Get('stats')
  async getStats(@Request() req) {
    const dealerId = req.user.dealerId;
    if (!dealerId) throw new ForbiddenException('No dealer profile linked');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const [
      totalActivations,
      activationsToday,
      activationsWeek,
      activationsMonth,
      uniqueCustomers,
      dealer,
    ] = await Promise.all([
      this.prisma.activation.count({ where: { dealerId } }),
      this.prisma.activation.count({
        where: { dealerId, createdAt: { gte: todayStart } },
      }),
      this.prisma.activation.count({
        where: { dealerId, createdAt: { gte: weekStart } },
      }),
      this.prisma.activation.count({
        where: { dealerId, createdAt: { gte: monthStart } },
      }),
      this.prisma.activation
        .groupBy({
          by: ['customerId'],
          where: { dealerId },
        })
        .then((groups) => groups.length),
      this.prisma.dealer.findUnique({
        where: { id: dealerId },
        select: { points: true, code: true, name: true, shopName: true },
      }),
    ]);

    return {
      dealer,
      totalActivations,
      activationsToday,
      activationsWeek,
      activationsMonth,
      uniqueCustomers,
      totalPoints: dealer?.points ?? 0,
    };
  }

  /** GET /dealer/me/activations — dealer's own activation list */
  @Get('activations')
  async getActivations(
    @Request() req,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const dealerId = req.user.dealerId;
    if (!dealerId) throw new ForbiddenException('No dealer profile linked');

    const where: any = { dealerId };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search } } },
        { barcodeItem: { barcode: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activation.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          customer: { select: { name: true, phone: true } },
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
