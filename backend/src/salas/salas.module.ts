import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LivekitRoomProvider } from '../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../shared/livekit/livekit-token.provider'
import { Sala } from '../shared/db/entidades/sala.entity'
import { Freio } from '../shared/freio'
import { SalasController } from './controllers/salas.controller'
import { SalasRepository } from './repositories/salas.repository'
import { CriarSalaUseCase } from './useCases/criarSala/CriarSalaUseCase'
import { EntrarNaSalaUseCase } from './useCases/entrarNaSala/EntrarNaSalaUseCase'
import { ListarSalasUseCase } from './useCases/listarSalas/ListarSalasUseCase'
import { SugerirNomeDeSalaUseCase } from './useCases/sugerirNomeDeSala/SugerirNomeDeSalaUseCase'

@Module({
  imports: [TypeOrmModule.forFeature([Sala])],
  controllers: [SalasController],
  providers: [
    SalasRepository,
    LivekitRoomProvider,
    LivekitTokenProvider,
    // useFactory (não a classe direto): o construtor de Freio tem um parâmetro de tipo função
    // (o relógio injetado) que o Nest tentaria resolver por DI e nunca vai achar provider para
    // — useFactory chama `new Freio()` sem passar pelo reflection de construtor.
    { provide: Freio, useFactory: () => new Freio() },
    ListarSalasUseCase,
    SugerirNomeDeSalaUseCase,
    CriarSalaUseCase,
    EntrarNaSalaUseCase,
  ],
})
export class SalasModule {}
