import { IsString, IsNotEmpty, IsArray, ValidateNested, Matches, Length } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateBarcodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  productSku: string;
}

export class CreateBarcodeBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBarcodeDto)
  items: CreateBarcodeDto[];
}

/**
 * DTO for POST /barcodes/scan-add
 * Frontend chỉ gửi barcode code — backend tự parse prefix → productId
 */
export class ScanAddBarcodeDto {
  @IsString()
  @IsNotEmpty({ message: 'Barcode không được để trống' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{12,40}$/, {
    message: 'Barcode chỉ gồm A-Z, 0-9, dài 12-40 ký tự',
  })
  code: string;
}
