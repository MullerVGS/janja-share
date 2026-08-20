import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigController } from './config/config.controller'
import { SalasModule } from './salas/salas.module'
import { Sala } from './shared/db/entidades/sala.entity'

@Module({
  imports: [
    // Lê DATABASE_URL direto de process.env (não via env()) para não exigir as demais envs
    // (LIVEKIT_*) em contextos que só precisam do banco — ex.: os testes que só sobem o módulo
    // de banco. Migrações rodam via helper de teste ou CLI, nunca no boot.
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: false,
      entities: [Sala],
      synchronize: false,
      migrations: [__dirname + '/shared/db/migrations/*{.ts,.js}'],
      migrationsRun: false,
    }),
    SalasModule,
  ],
  controllers: [ConfigController],
})
export class AppModule {}
