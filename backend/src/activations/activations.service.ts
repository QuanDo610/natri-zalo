import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivationDto } from './dto/create-activation.dto';

@Injectable()
export class ActivationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Core activation logic — runs inside a DB transaction to ensure atomicity.
   *
   * Steps:
   * 1. Find barcode item (must exist, must not be activated)
   * 2. Upsert customer by phone
   * 3. Optionally find dealer by code
   * 4. Mark barcode as activated
   * 5. Increment customer points
   * 6. Increment dealer points (if applicable)
   * 7. Create activation record
   * 8. Write audit log
   */
  async createActivation(dto: CreateActivationDto, staffId?: string | null) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find barcode item
      const barcodeItem = await tx.barcodeItem.findUnique({
        where: { barcode: dto.barcode },
        include: { product: true },
      });

      if (!barcodeItem) {
        throw new BadRequestException(`Barcode "${dto.barcode}" not found`);
      }

      if (barcodeItem.activated) {
        throw new ConflictException(
          `Barcode "${dto.barcode}" has already been activated`,
        );
      }

      // 2. Upsert customer
      const customer = await tx.customer.upsert({
        where: { phone: dto.customer.phone },
        update: { name: dto.customer.name },
        create: {
          name: dto.customer.name,
          phone: dto.customer.phone,
        },
      });

      // 3. Find dealer (optional)
      let dealer: any = null;
      if (dto.dealerCode) {
        dealer = await tx.dealer.findUnique({
          where: { code: dto.dealerCode },
        });
        if (!dealer) {
          throw new NotFoundException(
            `Dealer with code "${dto.dealerCode}" not found`,
          );
        }
        if (!dealer.active) {
          throw new BadRequestException(
            `Dealer "${dto.dealerCode}" is inactive`,
          );
        }
      }

      // 4. Mark barcode as activated
      await tx.barcodeItem.update({
        where: { id: barcodeItem.id },
        data: {
          activated: true,
          activatedAt: new Date(),
          status: 'USED',
          usedById: staffId || null,
        },
      });

      // 5. Increment customer points
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: { points: { increment: 1 } },
      });

      // 6. Increment dealer points (if applicable)
      let updatedDealer: any = null;
      if (dealer) {
        updatedDealer = await tx.dealer.update({
          where: { id: dealer.id },
          data: { points: { increment: 1 } },
        });
      }

      // 7. Create activation record
      const activation = await tx.activation.create({
        data: {
          barcodeItemId: barcodeItem.id,
          customerId: customer.id,
          dealerId: dealer?.id || null,
          staffId: staffId || null,
          productId: barcodeItem.productId,
          pointsAwarded: 1,
        },
      });

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          action: 'ACTIVATION_CREATED',
          entity: 'Activation',
          entityId: activation.id,
          userId: staffId || null,
          metadata: {
            barcode: dto.barcode,
            customerPhone: dto.customer.phone,
            customerName: dto.customer.name,
            dealerCode: dto.dealerCode || null,
            productName: barcodeItem.product.name,
            productSku: barcodeItem.product.sku,
          },
        },
      });

      return {
        activationId: activation.id,
        product: {
          id: barcodeItem.product.id,
          name: barcodeItem.product.name,
          sku: barcodeItem.product.sku,
        },
        customerPointsAfter: updatedCustomer.points,
        dealerPointsAfter: updatedDealer?.points ?? null,
      };
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    dealerId?: string;
    staffId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { skip = 0, take = 50, dealerId, staffId, dateFrom, dateTo } = params || {};
    const where: any = {};
    if (dealerId) where.dealerId = dealerId;
    if (staffId) where.staffId = staffId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.activation.findMany({
        where,
        skip,
        take,
        include: {
          product: { select: { name: true, sku: true } },
          customer: { select: { name: true, phone: true } },
          dealer: { select: { code: true, name: true } },
          staff: { select: { username: true, fullName: true } },
          barcodeItem: { select: { barcode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activation.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [totalToday, totalWeek, topDealers, topCustomers] = await Promise.all([
      this.prisma.activation.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.activation.count({
        where: { createdAt: { gte: weekStart } },
      }),
      this.prisma.dealer.findMany({
        orderBy: { points: 'desc' },
        take: 10,
        select: { code: true, name: true, shopName: true, points: true },
      }),
      this.prisma.customer.findMany({
        orderBy: { points: 'desc' },
        take: 10,
        select: { name: true, phone: true, points: true },
      }),
    ]);

    // Daily activations for last 30 days
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyActivations = await this.prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*)::int as count
      FROM activations
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return {
      totalToday,
      totalWeek,
      topDealers,
      topCustomers,
      dailyActivations,
    };
  }
}
