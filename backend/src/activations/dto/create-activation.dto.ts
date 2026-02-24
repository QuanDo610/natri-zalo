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
  /** Barcode: 8-20 digits */
  @IsString()
  @Matches(/^\d{8,20}$/, {
    message: 'Barcode must be 8-20 digits',
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
