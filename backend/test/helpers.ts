import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'
import { configurarApp } from '../src/bootstrap'

/**
 * `dirPublico` é repassado a configurarApp() — só usado pelo spa.e2e-spec.ts, que precisa de
 * um bundle de verdade num diretório temporário para exercitar a fronteira SPA×API.
 */
export async function criarApp(dirPublico?: string): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = mod.createNestApplication()
  configurarApp(app, dirPublico)
  await app.init()
  await app.get(DataSource).runMigrations()
  return app
}

export const dataSource = (app: INestApplication) => app.get(DataSource)
