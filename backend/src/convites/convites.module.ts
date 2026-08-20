import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Convite } from '../shared/db/entidades/convite.entity'
import { LivekitTokenProvider } from '../shared/livekit/livekit-token.provider'
import { AdminConvitesController } from './controllers/admin-convites.controller'
import { EntradaController } from './controllers/entrada.controller'
import { ConvitesRepository } from './repositories/convites.repository'
import { CriarConviteUseCase } from './useCases/criarConvite/CriarConviteUseCase'
import { EntrarUseCase } from './useCases/entrar/EntrarUseCase'
import { ListarConvitesUseCase } from './useCases/listarConvites/ListarConvitesUseCase'
import { RevogarConviteUseCase } from './useCases/revogarConvite/RevogarConviteUseCase'
import { VerificarConviteUseCase } from './useCases/verificarConvite/VerificarConviteUseCase'

@Module({
  imports: [TypeOrmModule.forFeature([Convite])],
  controllers: [EntradaController, AdminConvitesController],
  providers: [
    ConvitesRepository,
    LivekitTokenProvider,
    VerificarConviteUseCase,
    EntrarUseCase,
    CriarConviteUseCase,
    ListarConvitesUseCase,
    RevogarConviteUseCase,
  ],
})
export class ConvitesModule {}
