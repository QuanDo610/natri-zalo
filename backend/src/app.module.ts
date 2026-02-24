import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DealersModule } from './dealers/dealers.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { ActivationsModule } from './activations/activations.module';
import { MeModule } from './me/me.module';
import { BarcodesModule } from './barcodes/barcodes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DealersModule,
    ProductsModule,
    CustomersModule,
    ActivationsModule,
    MeModule,
    BarcodesModule,
  ],
})
export class AppModule {}
