import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'
import { configurarApp } from '../src/bootstrap'
import { LivekitRoomProvider } from '../src/shared/livekit/livekit-room.provider'

export interface OpcoesApp {
  /** Só usado por spa.e2e-spec.ts, que precisa de um bundle de verdade num diretório temporário. */
  dirPublico?: string
  /**
   * O SFU real não está de pé nos testes — quem precisa exercitar as rotas de salas troca o
   * LivekitRoomProvider por um dublê aqui, via container do Nest (nunca por mock de módulo).
   */
  roomProvider?: LivekitRoomProvider
}

export async function criarApp(opcoes: OpcoesApp = {}): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
  if (opcoes.roomProvider) {
    builder = builder.overrideProvider(LivekitRoomProvider).useValue(opcoes.roomProvider)
  }
  const mod = await builder.compile()
  const app = mod.createNestApplication()
  configurarApp(app, opcoes.dirPublico)
  await app.init()
  await app.get(DataSource).runMigrations()
  return app
}

export const dataSource = (app: INestApplication) => app.get(DataSource)
