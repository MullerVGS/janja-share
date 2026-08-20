import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { criarApp, dataSource } from './helpers'

describe('GET /api/config', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await criarApp()
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  it('devolve urlSfu vindo das envs', async () => {
    const res = await request(app.getHttpServer()).get('/api/config').expect(200)
    expect(res.body).toEqual({ urlSfu: process.env.LIVEKIT_URL })
  })
})
