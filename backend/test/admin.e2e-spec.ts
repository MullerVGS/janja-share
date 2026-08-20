import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { criarConviteDeTeste, rotasAdmin } from './fixtures'
import { criarApp, dataSource } from './helpers'

const HOST_ERRADO = 'share.example.com'

describe('/api/admin/*', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await criarApp()
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  it('toda rota mapeada em /api/admin/* devolve 404 com Host errado — o mesmo corpo de uma rota inexistente', async () => {
    const rotas = rotasAdmin(app)
    // Se a introspecção do router quebrar (troca de HTTP adapter, por exemplo), o teste falha
    // aqui em vez de passar vazio e sem testar nada.
    expect(rotas.length).toBeGreaterThanOrEqual(4)

    const rotaInexistente = await request(app.getHttpServer()).get('/api/isto-nao-existe-de-verdade').set('Host', HOST_ERRADO)
    expect(rotaInexistente.status).toBe(404)
    // O literal, e não só "igual ao da outra rota": este é o corpo que o front casa para dizer
    // "abra pelo endereço admin" (frontend/src/telas/Admin/Admin.tsx). Sem fixá-lo aqui, os dois
    // lados podiam divergir com os dois testes verdes.
    expect(rotaInexistente.body).toEqual({ erro: 'nao_encontrado' })

    for (const { metodo, caminho } of rotas) {
      const caminhoConcreto = caminho.replace(':id', '00000000-0000-0000-0000-000000000000')
      const res = await request(app.getHttpServer())[metodo](caminhoConcreto).set('Host', HOST_ERRADO)
      expect(res.status).toBe(404)
      // Corpo idêntico ao de uma rota que nem existe — o guard não pode "vazar" um formato
      // de erro diferente que denuncie, por exclusão, que a rota está ali.
      expect(res.body).toEqual({ erro: 'nao_encontrado' })
      expect(res.body).toEqual(rotaInexistente.body)
      expect(res.headers['content-type']).toEqual(rotaInexistente.headers['content-type'])
    }
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

  it('rótulo só com espaços é trimado e rejeitado (400), não vira convite em branco', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/convites')
      .set('Host', process.env.HOST_ADMIN!)
      .send({ rotulo: '   ', validadeHoras: 24, usosMax: 1 })
    expect(res.status).toBe(400)

    const res2 = await request(app.getHttpServer())
      .post('/api/admin/convites')
      .set('Host', process.env.HOST_ADMIN!)
      .send({ rotulo: '  Pessoal  ', validadeHoras: 24, usosMax: 1 })
      .expect(201)
    expect(res2.body.rotulo).toBe('Pessoal')
  })

  it('GET /api/admin/sala nunca quebra mesmo com o SFU fora do ar', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/sala').set('Host', process.env.HOST_ADMIN!).expect(200)
    expect(res.body).toEqual({ participantes: [] })
  })
})
