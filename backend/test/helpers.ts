import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'
import { ErroApiFilter, ErroInternoFilter } from '../src/shared/erros'

export async function criarApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = mod.createNestApplication()
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Mesma ordem de main.ts: fallback (ErroInternoFilter) primeiro, específico (ErroApiFilter) depois.
  app.useGlobalFilters(new ErroInternoFilter(), new ErroApiFilter())
  await app.init()
  await app.get(DataSource).runMigrations()
  return app
}

export const dataSource = (app: INestApplication) => app.get(DataSource)
