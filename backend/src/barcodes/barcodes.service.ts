import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Prefix → Product SKU mapping (5 sản phẩm cố định) ──────────
const PREFIX_TO_SKU: Record<string, string> = {
  '12N5L': '12N5L',
  '12N7L': '12N7L',
  'YTX4A': 'YTX4A',
  'YTX5A': 'YTX5A',
  'YTX7A': 'YTX7A',
};

const VALID_PREFIXES = Object.keys(PREFIX_TO_SKU);

@Injectable()
export class BarcodesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Parse barcode prefix → return matched SKU.
   * Nếu không match prefix → throw INVALID_BARCODE_FORMAT
   */
  private parsePrefix(code: string): string {
    const upper = code.trim().toUpperCase();

    // Validate format: chỉ A-Z 0-9, 12-40 ký tự
    if (!/^[A-Z0-9]{12,40}$/.test(upper)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_BARCODE_FORMAT',
        message: `Barcode "${code}" không hợp lệ. Chỉ gồm A-Z, 0-9, dài 12-40 ký tự.`,
      });
    }

    // Find matching prefix
    const matchedPrefix = VALID_PREFIXES.find((prefix) =>
      upper.startsWith(prefix),
    );

    if (!matchedPrefix) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_BARCODE_FORMAT',
        message: `Barcode "${code}" không bắt đầu bằng đầu mã hợp lệ (${VALID_PREFIXES.join(', ')}).`,
      });
    }

    return PREFIX_TO_SKU[matchedPrefix];
  }

  /**
   * POST /barcodes/scan-add — Camera scan flow.
   * Backend tự parse prefix → tìm product → lưu BarcodeItem.
   */
  async scanAddBarcode(code: string, createdById: string) {
    const normalizedCode = code.trim().toUpperCase();

    // 1. Validate format + parse prefix → SKU
    const sku = this.parsePrefix(normalizedCode);

    // 2. Find product by SKU
    const product = await this.prisma.product.findUnique({
      where: { sku },
    });
    if (!product) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'PRODUCT_NOT_FOUND',
        message: `Sản phẩm với SKU "${sku}" chưa được tạo trong hệ thống. Hãy chạy seed trước.`,
      });
    }

    // 3. Check duplicate barcode
    const existing = await this.prisma.barcodeItem.findUnique({
      where: { barcode: normalizedCode },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'BARCODE_ALREADY_EXISTS',
        message: `Barcode "${normalizedCode}" đã tồn tại trong hệ thống.`,
      });
    }

    // 4. Insert BarcodeItem
    const barcodeItem = await this.prisma.barcodeItem.create({
      data: {
        barcode: normalizedCode,
        productId: product.id,
        createdById,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { username: true, fullName: true } },
      },
    });

    // 5. Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'BARCODE_SCANNED_ADD',
        entity: 'BarcodeItem',
        entityId: barcodeItem.id,
        userId: createdById,
        metadata: {
          barcode: normalizedCode,
          productSku: sku,
          productName: product.name,
          method: 'camera_scan',
        },
      },
    });

    return {
      id: barcodeItem.id,
      code: barcodeItem.barcode,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
      },
      status: barcodeItem.status,
      createdAt: barcodeItem.createdAt,
      createdBy: barcodeItem.createdBy,
    };
  }

  /**
   * Add a single barcode to the system (manual flow with productSku).
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
