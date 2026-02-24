import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findByBarcode(barcode: string) {
    const barcodeItem = await this.prisma.barcodeItem.findUnique({
      where: { barcode },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
      },
    });

    if (!barcodeItem) {
      throw new NotFoundException(`Barcode "${barcode}" not found`);
    }

    return {
      id: barcodeItem.product.id,
      name: barcodeItem.product.name,
      sku: barcodeItem.product.sku,
      barcode: barcodeItem.barcode,
      activated: barcodeItem.activated,
      activatedAt: barcodeItem.activatedAt,
    };
  }

  async findAll(params?: { skip?: number; take?: number }) {
    const { skip = 0, take = 50 } = params || {};
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count(),
    ]);
    return { data, total, skip, take };
  }

  async create(data: { name: string; sku: string }) {
    return this.prisma.product.create({ data });
  }

  async importBarcodes(productId: string, barcodes: string[]) {
    const items = barcodes.map((barcode) => ({
      barcode,
      productId,
    }));

    return this.prisma.barcodeItem.createMany({
      data: items,
      skipDuplicates: true,
    });
  }

  async findBarcodes(params?: { skip?: number; take?: number; productId?: string; activated?: boolean }) {
    const { skip = 0, take = 50, productId, activated } = params || {};
    const where: any = {};
    if (productId) where.productId = productId;
    if (activated !== undefined) where.activated = activated;

    const [data, total] = await Promise.all([
      this.prisma.barcodeItem.findMany({
        where,
        skip,
        take,
        include: {
          product: { select: { name: true, sku: true } },
          activation: {
            select: {
              id: true,
              createdAt: true,
              customer: { select: { name: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.barcodeItem.count({ where }),
    ]);
    return { data, total, skip, take };
  }
}
