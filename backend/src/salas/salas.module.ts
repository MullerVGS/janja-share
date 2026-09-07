import { Module } from '@nestjs/common'
import { LivekitRoomProvider } from '../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../shared/livekit/livekit-token.provider'
import { Freio } from '../shared/freio'
import { SalasController } from './controllers/salas.controller'
import { CriarSalaUseCase } from './useCases/criarSala/CriarSalaUseCase'
import { EntrarNaSalaUseCase } from './useCases/entrarNaSala/EntrarNaSalaUseCase'
import { ListarSalasUseCase } from './useCases/listarSalas/ListarSalasUseCase'
import { SugerirNomeDeSalaUseCase } from './useCases/sugerirNomeDeSala/SugerirNomeDeSalaUseCase'

@Module({
  controllers: [SalasController],
  providers: [
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
