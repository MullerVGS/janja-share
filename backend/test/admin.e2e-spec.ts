import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { criarConviteDeTeste } from './fixtures'
import { criarApp, dataSource } from './helpers'

describe('/api/admin/*', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await criarApp()
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  it('Host diferente de HOST_ADMIN devolve 404 em toda rota admin', async () => {
    await request(app.getHttpServer()).get('/api/admin/convites').set('Host', 'share.example.com').expect(404)
    await request(app.getHttpServer()).get('/api/admin/sala').set('Host', 'share.example.com').expect(404)
  })

  it('Host === HOST_ADMIN devolve 200 e lista convites', async () => {
    await criarConviteDeTeste(app, { rotulo: 'Pessoal' })

    const res = await request(app.getHttpServer()).get('/api/admin/convites').set('Host', process.env.HOST_ADMIN!).expect(200)

    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((c: { rotulo: string }) => c.rotulo === 'Pessoal')).toBe(true)
  })

  it('Host ignora porta e caixa', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/convites')
      .set('Host', `${process.env.HOST_ADMIN!.toUpperCase()}:8443`)
      .expect(200)
  })

  it('POST cria e DELETE revoga; DELETE de id inexistente devolve 404', async () => {
    const { id } = await criarConviteDeTeste(app, { rotulo: 'Para revogar' })

    await request(app.getHttpServer()).delete(`/api/admin/convites/${id}`).set('Host', process.env.HOST_ADMIN!).expect(204)

    const listaRes = await request(app.getHttpServer()).get('/api/admin/convites').set('Host', process.env.HOST_ADMIN!).expect(200)
    const revogado = listaRes.body.find((c: { id: string }) => c.id === id)
    expect(revogado.ativo).toBe(false)
    expect(revogado.revogadoEm).not.toBeNull()

    await request(app.getHttpServer())
      .delete('/api/admin/convites/00000000-0000-0000-0000-000000000000')
      .set('Host', process.env.HOST_ADMIN!)
      .expect(404)
  })

  it('GET /api/admin/sala nunca quebra mesmo com o SFU fora do ar', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/sala').set('Host', process.env.HOST_ADMIN!).expect(200)
    expect(res.body).toEqual({ participantes: [] })
  })
})
