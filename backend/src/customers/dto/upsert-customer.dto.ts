import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class UpsertCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Vietnamese phone: 10 digits starting with 03|05|07|08|09 */
  @IsString()
  @Matches(/^0(3|5|7|8|9)\d{8}$/, {
    message: 'Phone must be a valid Vietnamese phone number (e.g. 0901234567)',
  })
  phone: string;
}
