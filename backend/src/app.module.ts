import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminHostGuard } from './admin/admin-host.guard'
import { ConfigController } from './config/config.controller'
import { ConvitesModule } from './convites/convites.module'
import { SalaModule } from './sala/sala.module'
import { Convite } from './shared/db/entidades/convite.entity'

@Module({
  imports: [
    // Lê DATABASE_URL direto de process.env (não via env()) para não exigir as demais envs
    // (LIVEKIT_*, HOST_ADMIN...) em contextos que só precisam do banco — ex.: os testes que só
    // sobem o módulo de banco. Migrações rodam via helper de teste ou CLI, nunca no boot.
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: false,
      entities: [Convite],
      synchronize: false,
      migrations: [__dirname + '/shared/db/migrations/*{.ts,.js}'],
      migrationsRun: false,
    }),
    ConvitesModule,
    SalaModule,
  ],
  controllers: [ConfigController],
  // Global: protege TODA /api/admin/* sem depender de @UseGuards() em cada controller admin.
  providers: [{ provide: APP_GUARD, useClass: AdminHostGuard }],
})
export class AppModule {}
