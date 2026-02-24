import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post('upsert')
  async upsert(@Body() dto: UpsertCustomerDto) {
    return this.customersService.upsert(dto);
  }

  @Get('by-phone/:phone')
  async findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  /** Admin */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      search,
    });
  }
}
