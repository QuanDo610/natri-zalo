import { Module } from '@nestjs/common';
import { DealerMeController } from './dealer-me.controller';

@Module({
  controllers: [DealerMeController],
})
export class DealerMeModule {}
