import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DealersService {
  constructor(private prisma: PrismaService) {}

  async lookupByCode(code: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { code, active: true },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        shopName: true,
        address: true,
        points: true,
      },
    });

    if (!dealer) {
      throw new NotFoundException(`Dealer with code "${code}" not found`);
    }

    return dealer;
  }

  async findAll(params?: { skip?: number; take?: number; search?: string }) {
    const { skip = 0, take = 50, search } = params || {};
    const where = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
            { shopName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.dealer.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.dealer.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async create(data: { code: string; name: string; phone: string; shopName: string; address?: string }) {
    return this.prisma.dealer.create({ data });
  }

  async update(id: string, data: { name?: string; phone?: string; shopName?: string; address?: string; active?: boolean }) {
    return this.prisma.dealer.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.dealer.update({ where: { id }, data: { active: false } });
  }
}
