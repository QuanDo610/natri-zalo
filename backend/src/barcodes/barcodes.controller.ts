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
import { CreateBarcodeDto, CreateBarcodeBatchDto, ScanAddBarcodeDto } from './dto/create-barcode.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('barcodes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class BarcodesController {
  constructor(private barcodesService: BarcodesService) {}

  /**
   * POST /barcodes — Add a single barcode (manual, with productSku)
   * Roles: STAFF, ADMIN
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
   * POST /barcodes/scan-add — Add barcode from camera scan
   * Backend tự parse prefix → product, không cần client chọn SKU
   * Roles: STAFF, ADMIN
   * Body: { code: "YTX5AN12020N2507302790" }
   * Errors: 409 BARCODE_ALREADY_EXISTS, 400 INVALID_BARCODE_FORMAT
   */
  @Post('scan-add')
  async scanAdd(@Body() dto: ScanAddBarcodeDto, @Request() req) {
    return this.barcodesService.scanAddBarcode(dto.code, req.user.id);
  }

  /**
   * POST /barcodes/batch — Add multiple barcodes
   * Roles: STAFF, ADMIN
   */
  @Post('batch')
  async createBatch(@Body() dto: CreateBarcodeBatchDto, @Request() req) {
    return this.barcodesService.createBatch(dto.items, req.user.id);
  }

  /**
   * GET /barcodes — List barcodes with filters
   * Roles: STAFF, ADMIN
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
