import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async upsert(dto: UpsertCustomerDto) {
    const customer = await this.prisma.customer.upsert({
      where: { phone: dto.phone },
      update: { name: dto.name },
      create: { name: dto.name, phone: dto.phone },
    });
    return customer;
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      include: {
        activations: {
          include: {
            product: { select: { name: true, sku: true } },
            dealer: { select: { code: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with phone "${phone}" not found`);
    }

    return customer;
  }

  async findAll(params?: { skip?: number; take?: number; search?: string }) {
    const { skip = 0, take = 50, search } = params || {};
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take, orderBy: { points: 'desc' } }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, total, skip, take };
  }
}
