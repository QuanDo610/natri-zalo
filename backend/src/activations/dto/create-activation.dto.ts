import {
  IsString,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerInfoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(/^0(3|5|7|8|9)\d{8}$/, {
    message: 'Phone must be a valid Vietnamese phone number (e.g. 0901234567)',
  })
  phone: string;
}

export class CreateActivationDto {
  /** Barcode: Must start with 12N5L, 12N7L, YTX4A, YTX5A, YTX7A OR numeric 8-20 */
  @IsString()
  @Matches(/^((12N5L|12N7L|YTX4A|YTX5A|YTX7A)[A-Z0-9]*|\d{8,20})$/, {
    message: 'Barcode không hợp lệ. Cần Natri Ion: 12N5L, 12N7L, YTX4A, YTX5A, YTX7A hoặc numeric 8-20',
  })
  barcode: string;

  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer: CustomerInfoDto;

  /** Optional dealer code (e.g. DL001) */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}\d{3,}$/, {
    message: 'Dealer code must match format like DL001',
  })
  dealerCode?: string;
}
