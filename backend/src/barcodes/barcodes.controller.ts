import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BarcodesService } from './barcodes.service';
import { CreateBarcodeDto, CreateBarcodeBatchDto } from './dto/create-barcode.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('barcodes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class BarcodesController {
  constructor(private barcodesService: BarcodesService) {}

  /**
   * POST /barcodes — Add a single barcode
   * Roles: STAFF, ADMIN
   * Body: { code: "8936...", productSku: "P001" }
   * Errors: 409 BARCODE_ALREADY_EXISTS, 404 PRODUCT_NOT_FOUND
   */
  @Post()
  async create(@Body() dto: CreateBarcodeDto, @Request() req) {
    return this.barcodesService.createBarcode(
      dto.code,
      dto.productSku,
      req.user.id,
    );
  }

  /**
   * POST /barcodes/batch — Add multiple barcodes
   * Roles: STAFF, ADMIN
   * Body: { items: [{ code: "..", productSku: "P001" }, ...] }
   */
  @Post('batch')
  async createBatch(@Body() dto: CreateBarcodeBatchDto, @Request() req) {
    return this.barcodesService.createBatch(dto.items, req.user.id);
  }

  /**
   * GET /barcodes — List barcodes with filters
   * Roles: STAFF, ADMIN
   * Query: sku, status (UNUSED|USED), q, skip, take
   */
  @Get()
  async findAll(
    @Query('sku') sku?: string,
    @Query('status') status?: 'UNUSED' | 'USED',
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.barcodesService.findAll({
      sku,
      status,
      q,
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
    });
  }
}
