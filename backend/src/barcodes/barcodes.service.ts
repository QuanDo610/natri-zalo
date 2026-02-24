import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BarcodesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add a single barcode to the system.
   * Staff/Admin only — tracks who created it.
   */
  async createBarcode(code: string, productSku: string, createdById: string) {
    // Find product by SKU
    const product = await this.prisma.product.findUnique({
      where: { sku: productSku },
    });
    if (!product) {
      throw new NotFoundException(`Product with SKU "${productSku}" not found`);
    }

    // Check duplicate
    const existing = await this.prisma.barcodeItem.findUnique({
      where: { barcode: code },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'BARCODE_ALREADY_EXISTS',
        message: `Barcode "${code}" already exists`,
      });
    }

    const barcode = await this.prisma.barcodeItem.create({
      data: {
        barcode: code,
        productId: product.id,
        createdById,
      },
      include: {
        product: { select: { name: true, sku: true } },
        createdBy: { select: { username: true, fullName: true } },
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'BARCODE_CREATED',
        entity: 'BarcodeItem',
        entityId: barcode.id,
        userId: createdById,
        metadata: {
          barcode: code,
          productSku,
          productName: product.name,
        },
      },
    });

    return barcode;
  }

  /**
   * Add multiple barcodes in a batch.
   * Returns success/failure counts and details.
   */
  async createBatch(
    items: { code: string; productSku: string }[],
    createdById: string,
  ) {
    const results: { code: string; status: 'created' | 'error'; error?: string }[] = [];

    for (const item of items) {
      try {
        await this.createBarcode(item.code, item.productSku, createdById);
        results.push({ code: item.code, status: 'created' });
      } catch (err: any) {
        results.push({
          code: item.code,
          status: 'error',
          error: err.message || 'Unknown error',
        });
      }
    }

    return {
      total: items.length,
      created: results.filter((r) => r.status === 'created').length,
      errors: results.filter((r) => r.status === 'error').length,
      details: results,
    };
  }

  /**
   * List barcodes with filters: sku, status, search query, pagination.
   */
  async findAll(params: {
    sku?: string;
    status?: 'UNUSED' | 'USED';
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const { sku, status, q, skip = 0, take = 50 } = params;
    const where: any = {};

    if (sku) {
      where.product = { sku };
    }

    if (status) {
      where.status = status;
    }

    if (q) {
      where.barcode = { contains: q };
    }

    const [data, total] = await Promise.all([
      this.prisma.barcodeItem.findMany({
        where,
        skip,
        take,
        include: {
          product: { select: { name: true, sku: true } },
          createdBy: { select: { username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.barcodeItem.count({ where }),
    ]);

    return { data, total, skip, take };
  }
}
