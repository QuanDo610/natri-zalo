import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { CreateActivationDto } from './dto/create-activation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('activations')
export class ActivationsController {
  constructor(private activationsService: ActivationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateActivationDto, @Request() req) {
    return this.activationsService.createActivation(dto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('dealerId') dealerId?: string,
    @Query('staffId') staffId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.activationsService.findAll({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      dealerId,
      staffId,
      dateFrom,
      dateTo,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getStats() {
    return this.activationsService.getStats();
  }
}
