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
   * Core activation logic — only validate barcode format
   * 
   * Steps:
   * 1. Validate barcode format (must start with 5 valid product codes)
   * 2. Check if barcode already activated (avoid duplicate points)
   * 3. Upsert customer
   * 4. Find or create product (based on prefix)
   * 5. Create barcode item if not exist
   * 6. Find dealer (if provided)
   * 7. Create activation record
   * 8. Increment points
   */
  async createActivation(dto: CreateActivationDto, staffId?: string | null) {
    const barcode = dto.barcode.trim().toUpperCase();

    // 1. Validate barcode format
    const VALID_PREFIXES = ['12N5L', '12N7L', 'YTX4A', 'YTX5A', 'YTX7A'];
    const prefix5 = barcode.substring(0, 5);
    
    if (!VALID_PREFIXES.includes(prefix5)) {
      throw new BadRequestException(
        `Barcode phải bắt đầu bằng: ${VALID_PREFIXES.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Check if barcode already activated
      const alreadyActivated = await tx.activation.findFirst({
        where: {
          barcodeItem: { barcode },
        },
        select: { id: true },
      });

      if (alreadyActivated) {
        throw new ConflictException(
          `Barcode đã được tích điểm trước đó`,
        );
      }

      // 3. Upsert customer
      const customer = await tx.customer.upsert({
        where: { phone: dto.customer.phone },
        update: { name: dto.customer.name },
        create: {
          name: dto.customer.name,
          phone: dto.customer.phone,
        },
      });

      // 4. Find or create product
      const PRODUCT_MAP: Record<string, { sku: string; name: string }> = {
        '12N5L': { sku: '12N5L', name: 'Bình ắc quy Natri – Ion xe máy số 12N5L' },
        '12N7L': { sku: '12N7L', name: 'Bình ắc quy Natri Ion xe máy ga 12N7L' },
        'YTX4A': { sku: 'YTX4A', name: 'Bình ắc quy xe máy Natri Ion YTX4A' },
        'YTX5A': { sku: 'YTX5A', name: 'Bình ắc quy xe tay ga Natri Ion YTX5A' },
        'YTX7A': { sku: 'YTX7A', name: 'Bình ắc quy xe tay ga Natri Ion YTX7A' },
      };

      const productInfo = PRODUCT_MAP[prefix5];
      
      let product = await tx.product.findFirst({
        where: { sku: productInfo.sku },
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            name: productInfo.name,
            sku: productInfo.sku,
            barcode: prefix5,
          },
        });
      }

      // 5. Create barcode item if not exist, otherwise mark as used
      let barcodeItem = await tx.barcodeItem.findUnique({
        where: { barcode },
        select: { id: true },
      });

      if (!barcodeItem) {
        barcodeItem = await tx.barcodeItem.create({
          data: {
            barcode,
            productId: product.id,
            status: 'USED',
            activated: true,
            activatedAt: new Date(),
            usedById: staffId || null,
          },
          select: { id: true },
        });
      } else {
        // Barcode exists but not activated yet - mark it
        barcodeItem = await tx.barcodeItem.update({
          where: { id: barcodeItem.id },
          data: {
            status: 'USED',
            activated: true,
            activatedAt: new Date(),
            usedById: staffId || null,
          },
          select: { id: true },
        });
      }

      // 6. Find dealer (optional)
      let dealer: any = null;
      let updatedDealer: any = null;
      
      if (dto.dealerCode) {
        dealer = await tx.dealer.findUnique({
          where: { code: dto.dealerCode },
          select: { id: true, active: true, points: true },
        });

        if (!dealer) {
          throw new NotFoundException(`Dealer không tồn tại`);
        }

        if (!dealer.active) {
          throw new BadRequestException(`Dealer không hoạt động`);
        }

        // Increment dealer points
        updatedDealer = await tx.dealer.update({
          where: { id: dealer.id },
          data: { points: { increment: 1 } },
          select: { id: true, points: true },
        });
      }

      // 7. Create activation record
      const activation = await tx.activation.create({
        data: {
          barcodeItemId: barcodeItem.id,
          customerId: customer.id,
          dealerId: dealer?.id || null,
          staffId: staffId || null,
          productId: product.id,
          pointsAwarded: 1,
        },
        select: { id: true },
      });

      // 8. Increment customer points
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: { points: { increment: 1 } },
        select: { points: true },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'ACTIVATION_CREATED',
          entity: 'Activation',
          entityId: activation.id,
          userId: staffId || null,
          metadata: {
            barcode,
            productSku: product.sku,
            productName: product.name,
            customer: dto.customer.name,
          },
        },
      });

      return {
        activationId: activation.id,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
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
