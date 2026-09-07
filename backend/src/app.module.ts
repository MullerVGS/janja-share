import { Module } from '@nestjs/common'
import { ConfigController } from './config/config.controller'
import { SalasModule } from './salas/salas.module'

@Module({
  imports: [SalasModule],
  controllers: [ConfigController],
})
export class AppModule {}
