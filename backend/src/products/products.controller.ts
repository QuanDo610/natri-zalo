import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  /** Public — used by ZMP */
  @Get('by-barcode/:barcode')
  async findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  /** Admin */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.productsService.findAll({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() body: { name: string; sku: string }) {
    return this.productsService.create(body);
  }

  @Post(':id/import-barcodes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async importBarcodes(@Param('id') id: string, @Body() body: { barcodes: string[] }) {
    return this.productsService.importBarcodes(id, body.barcodes);
  }

  @Get('barcodes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async findBarcodes(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('productId') productId?: string,
    @Query('activated') activated?: string,
  ) {
    return this.productsService.findBarcodes({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      productId,
      activated: activated !== undefined ? activated === 'true' : undefined,
    });
  }
}
