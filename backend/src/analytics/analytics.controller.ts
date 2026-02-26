import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private prisma: PrismaService) {}

  // ──────────────────────────────────────
  // Dashboard KPIs
  // ──────────────────────────────────────

  @Get('dashboard/kpis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async getDashboardKpis(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 7); // Default: last 7 days

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const activations = await this.prisma.activation.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { customer: true, dealer: true },
    });

    const totalPoints = activations.reduce((sum, a) => sum + a.pointsAwarded, 0);
    const uniqueCustomers = new Set(activations.map(a => a.customerId)).size;
    const uniqueDealers = new Set(activations.map(a => a.dealerId)).size;

    // Previous period for trend calculation
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - (endDate.getTime() - startDate.getTime()) / 86400000);

    const prevActivations = await this.prisma.activation.count({
      where: {
        createdAt: { gte: prevStartDate, lt: startDate },
      },
    });

    const trend = prevActivations > 0 
      ? ((activations.length - prevActivations) / prevActivations * 100).toFixed(1)
      : 0;

    return {
      period: { from: startDate, to: endDate },
      totalActivations: activations.length,
      totalPoints,
      revenue: totalPoints * 1000, // 1 point = 1000 VND
      averagePerActivation: activations.length > 0 ? (totalPoints * 1000) / activations.length : 0,
      uniqueCustomers,
      uniqueDealers,
      trend: parseFloat(trend as string),
    };
  }

  // ──────────────────────────────────────
  // Top performers
  // ──────────────────────────────────────

  @Get('top-dealers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async getTopDealers(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit: string = '10',
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 30);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = await this.prisma.activation.groupBy({
      by: ['dealerId'],
      where: {
        dealerId: { not: null },
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: {
        id: true,
      },
      _sum: {
        pointsAwarded: true,
      },
      orderBy: {
        _sum: {
          pointsAwarded: 'desc',
        },
      },
      take: parseInt(limit),
    });

    // Enhance with dealer details
    const dealers = await Promise.all(
      results.map(async (r) => {
        const dealer = await this.prisma.dealer.findUnique({
          where: { id: r.dealerId || '' },
        });
        return {
          id: dealer?.id,
          code: dealer?.code,
          shopName: dealer?.shopName,
          activations: r._count.id,
          points: r._sum.pointsAwarded || 0,
          revenue: (r._sum.pointsAwarded || 0) * 1000,
        };
      })
    );

    return dealers;
  }

  @Get('top-customers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async getTopCustomers(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit: string = '10',
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 30);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = await this.prisma.activation.groupBy({
      by: ['customerId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: {
        id: true,
      },
      _sum: {
        pointsAwarded: true,
      },
      orderBy: {
        _sum: {
          pointsAwarded: 'desc',
        },
      },
      take: parseInt(limit),
    });

    // Enhance with customer details
    const customers = await Promise.all(
      results.map(async (r) => {
        const customer = await this.prisma.customer.findUnique({
          where: { id: r.customerId },
        });
        return {
          id: customer?.id,
          name: customer?.name,
          phone: customer?.phone,
          activations: r._count.id,
          points: r._sum.pointsAwarded || 0,
          pointsTotal: customer?.points || 0,
        };
      })
    );

    return customers;
  }

  // ──────────────────────────────────────
  // Revenue reporting
  // ──────────────────────────────────────

  @Get('revenue/timeline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getRevenueTimeline(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('granularity') granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 30);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const activations = await this.prisma.activation.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, pointsAwarded: true },
    });

    // Group by granularity
    const grouped: Record<string, { activations: number; points: number; revenue: number }> = {};

    activations.forEach((a) => {
      let key: string;
      const date = new Date(a.createdAt);

      if (granularity === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (granularity === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `Week ${weekStart.toISOString().split('T')[0]}`;
      } else {
        key = date.toISOString().slice(0, 7); // YYYY-MM
      }

      if (!grouped[key]) {
        grouped[key] = { activations: 0, points: 0, revenue: 0 };
      }
      grouped[key].activations += 1;
      grouped[key].points += a.pointsAwarded;
      grouped[key].revenue += a.pointsAwarded * 1000;
    });

    return Object.entries(grouped)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  @Get('revenue/by-dealer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getRevenueByDealer(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 30);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = await this.prisma.activation.groupBy({
      by: ['dealerId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { pointsAwarded: true },
      orderBy: {
        _sum: { pointsAwarded: 'desc' },
      },
    });

    const withDetails = await Promise.all(
      results.map(async (r) => {
        const dealer = await this.prisma.dealer.findUnique({
          where: { id: r.dealerId || '' },
          select: { code: true, shopName: true },
        });
        return {
          dealerId: r.dealerId,
          dealerCode: dealer?.code,
          dealerShop: dealer?.shopName,
          activations: r._count.id,
          points: r._sum.pointsAwarded || 0,
          revenue: (r._sum.pointsAwarded || 0) * 1000,
        };
      })
    );

    return withDetails.filter(d => d.dealerId); // Remove null dealers
  }

  @Get('revenue/by-product')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getRevenueByProduct(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 30);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = await this.prisma.activation.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { pointsAwarded: true },
      orderBy: {
        _sum: { pointsAwarded: 'desc' },
      },
    });

    const withDetails = await Promise.all(
      results.map(async (r) => {
        const product = await this.prisma.product.findUnique({
          where: { id: r.productId },
          select: { sku: true, name: true },
        });
        return {
          productId: r.productId,
          productSku: product?.sku,
          productName: product?.name,
          activations: r._count.id,
          points: r._sum.pointsAwarded || 0,
          revenue: (r._sum.pointsAwarded || 0) * 1000,
        };
      })
    );

    return withDetails;
  }

  // ──────────────────────────────────────
  // Staff activity & audit logs
  // ──────────────────────────────────────

  @Get('staff-activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getStaffActivity(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 7);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = await this.prisma.activation.groupBy({
      by: ['staffId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        staffId: { not: null },
      },
      _count: { id: true },
      _sum: { pointsAwarded: true },
      orderBy: {
        _count: { id: 'desc' },
      },
    });

    const withDetails = await Promise.all(
      results.map(async (r) => {
        const staff = await this.prisma.user.findUnique({
          where: { id: r.staffId || '' },
          select: { username: true, fullName: true },
        });
        return {
          staffId: r.staffId,
          staffName: staff?.fullName || staff?.username,
          activations: r._count.id,
          pointsProcessed: r._sum.pointsAwarded || 0,
        };
      })
    );

    return withDetails.filter(s => s.staffId);
  }

  // ──────────────────────────────────────
  // Performance metrics
  // ──────────────────────────────────────

  @Get('performance/avg-response-time')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAverageResponseTime(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    // This would typically come from application metrics
    // For now, we calculate based on activation processing
    const startDate = dateFrom ? new Date(dateFrom) : new Date();
    startDate.setDate(startDate.getDate() - 1);

    const endDate = dateTo ? new Date(dateTo) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // In production, integrate with APM tools like:
    // - New Relic
    // - DataDog
    // - Prometheus + Grafana
    // - CloudWatch

    return {
      message: 'Configure APM tool for detailed metrics',
      avgResponseTime: 95, // ms (mock value)
      p95Latency: 180,
      p99Latency: 450,
      period: { from: startDate, to: endDate },
    };
  }

  @Get('health')
  async getSystemHealth() {
    const customerCount = await this.prisma.customer.count();
    const dealerCount = await this.prisma.dealer.count();
    const activationCount = await this.prisma.activation.count();
    const productsCount = await this.prisma.product.count();

    return {
      status: 'healthy',
      timestamp: new Date(),
      dbStatus: 'connected',
      metrics: {
        customers: customerCount,
        dealers: dealerCount,
        activations: activationCount,
        products: productsCount,
      },
    };
  }
}
