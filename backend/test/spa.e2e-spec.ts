import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { criarApp, dataSource } from './helpers'

/**
 * Reproduz o cenário exato do bug original: o fallback do SPA só vaza rota de API quando um
 * bundle de verdade está montado (sem bundle, montarSpa() nem registra os middlewares — ver
 * shared/http/spa.ts). Por isso este spec monta um index.html fixo num diretório temporário,
 * a mesma coisa que o Dockerfile produz em dist/publico na imagem de produção.
 */
describe('fronteira SPA × API (com bundle presente)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const dirPublico = mkdtempSync(join(tmpdir(), 'share-spa-teste-'))
    writeFileSync(join(dirPublico, 'index.html'), '<!doctype html><title>casca do spa</title>')
    app = await criarApp({ dirPublico })
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  it('GET /api/config continua JSON mesmo com o bundle do SPA montado', async () => {
    const res = await request(app.getHttpServer()).get('/api/config').expect(200)
    expect(res.headers['content-type']).toMatch(/json/)
    expect(res.body).toHaveProperty('urlSfu')
  })

  it('caixa alta em /api/* chega no mesmo controller (Express roteia case-insensitive)', async () => {
    const normal = await request(app.getHttpServer()).get('/api/config')
    const caixaAlta = await request(app.getHttpServer()).get('/API/config')

    for (const res of [normal, caixaAlta]) {
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/json/)
      expect(res.body).toHaveProperty('urlSfu')
    }
  })

  it('barra repetida antes de /api nunca vira a casca do SPA — mesmo sem chegar no controller', async () => {
    // `//api/...` não é o mesmo path que `/api/...` para o router do Express (ele não colapsa
    // barras repetidas): não bate com nenhuma rota registrada, então cai no 404 genérico do
    // Nest em vez de no controller de config. A garantia que importa aqui não é "chegou no
    // controller certo" — é "nunca virou 200 text/html com a casca do app por engano".
    const res = await request(app.getHttpServer()).get('//api/config')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/json/)
  })

  it('rota de API inexistente devolve 404 JSON, mesmo em caixa alta', async () => {
    const res = await request(app.getHttpServer()).get('/API/Isto/Nao/Existe')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/json/)
    expect(res.body).toEqual({ erro: 'nao_encontrado' })
  })

  it('uma rota de verdade do SPA (sem extensão, fora de /api) devolve a casca do index.html', async () => {
    const res = await request(app.getHttpServer()).get('/sala/jogatina').expect(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain('casca do spa')
  })
})
