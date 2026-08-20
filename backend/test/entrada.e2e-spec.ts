import { INestApplication } from '@nestjs/common'
import { TokenVerifier } from 'livekit-server-sdk'
import request from 'supertest'
import { criarConviteDeTeste } from './fixtures'
import { criarApp, dataSource } from './helpers'

describe('GET /api/convites/:token', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await criarApp()
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  it('convite válido: 200 com o rótulo, e não consome uso', async () => {
    const { token } = await criarConviteDeTeste(app, { rotulo: 'Pessoal', usosMax: 1 })

    const res = await request(app.getHttpServer()).get(`/api/convites/${token}`).expect(200)
    expect(res.body).toEqual({ valido: true, rotulo: 'Pessoal' })

    // ainda dá para entrar depois — a pré-checagem não gastou o único uso.
    await request(app.getHttpServer()).post('/api/entrar').send({ convite: token, nome: 'Ana' }).expect(200)
  })

  it('convite inexistente: 404 convite_invalido', async () => {
    const res = await request(app.getHttpServer()).get('/api/convites/nao-existe').expect(404)
    expect(res.body).toEqual({ erro: 'convite_invalido' })
  })

  it('convite esgotado: 410 convite_esgotado', async () => {
    const { token } = await criarConviteDeTeste(app, { usosMax: 1 })
    await request(app.getHttpServer()).post('/api/entrar').send({ convite: token, nome: 'Primeiro' }).expect(200)

    const res = await request(app.getHttpServer()).get(`/api/convites/${token}`).expect(410)
    expect(res.body).toEqual({ erro: 'convite_esgotado' })
  })

  it('convite revogado: 410 convite_revogado', async () => {
    const { id, token } = await criarConviteDeTeste(app)
    await request(app.getHttpServer()).delete(`/api/admin/convites/${id}`).set('Host', process.env.HOST_ADMIN!).expect(204)

    const res = await request(app.getHttpServer()).get(`/api/convites/${token}`).expect(410)
    expect(res.body).toEqual({ erro: 'convite_revogado' })
  })
})

describe('POST /api/entrar', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await criarApp()
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  it('caminho feliz: devolve um JWT do LiveKit assinado, com os grants do contrato', async () => {
    const { token } = await criarConviteDeTeste(app, { usosMax: 5 })

    const res = await request(app.getHttpServer()).post('/api/entrar').send({ convite: token, nome: 'Ana' }).expect(200)

    expect(res.body).toMatchObject({ sala: 'share', urlSfu: process.env.LIVEKIT_URL, nome: 'Ana' })
    expect(res.body.identidade).toMatch(/^ana-[0-9a-f]{6}$/)

    // Verificação de verdade (assinatura + claims), não decodificação cega: prova que o JWT
    // valida contra a mesma chave/segredo que o LiveKit usaria.
    const verificador = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)
    const claims = await verificador.verify(res.body.token)
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: 'share',
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    expect(claims.name).toBe('Ana')
  })

  it('convite inexistente devolve 404 convite_invalido', async () => {
    const res = await request(app.getHttpServer()).post('/api/entrar').send({ convite: 'nao-existe', nome: 'Alguém' }).expect(404)
    expect(res.body).toEqual({ erro: 'convite_invalido' })
  })

  it('nome vazio devolve 400 nome_invalido', async () => {
    const { token } = await criarConviteDeTeste(app)
    const res = await request(app.getHttpServer()).post('/api/entrar').send({ convite: token, nome: '   ' }).expect(400)
    expect(res.body).toEqual({ erro: 'nome_invalido' })
  })
})
