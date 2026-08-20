import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { cifrar, confere } from '../src/shared/senha'
import { LivekitRoomProviderFalso } from './salas-fake'
import { criarApp, dataSource } from './helpers'

/**
 * Cada teste usa um X-Forwarded-For próprio (trust proxy: 1 respeita o header — ver
 * bootstrap.ts) para não dividir o freio (por IP, em memória do processo, compartilhado por
 * toda a suíte que usa este `app`) com os outros testes do arquivo.
 */
let proximoIp = 1
function ipDeTeste(): string {
  proximoIp += 1
  return `10.0.0.${proximoIp}`
}

describe('salas/', () => {
  let app: INestApplication
  let sfu: LivekitRoomProviderFalso

  beforeAll(async () => {
    sfu = new LivekitRoomProviderFalso()
    app = await criarApp({ roomProvider: sfu })
  })

  afterAll(async () => {
    await dataSource(app).destroy()
    await app.close()
  })

  beforeEach(async () => {
    sfu.salasAtuais = []
    sfu.deveFalhar = false
    await dataSource(app).query(`TRUNCATE TABLE salas`)
  })

  describe('GET /api/salas', () => {
    it('lista salas com pessoas e telas no ar', async () => {
      sfu.salasAtuais = [{ slug: 'jogatina', nome: 'Jogatina', pessoas: ['Ana', 'Bea'], telasNoAr: 1, cheia: false }]

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body).toEqual([{ slug: 'jogatina', nome: 'Jogatina', pessoas: ['Ana', 'Bea'], telasNoAr: 1, temSenha: false, cheia: false }])
    })

    it('sala vazia (em carência) aparece na lista', async () => {
      sfu.salasAtuais = [{ slug: 'vazia', nome: 'Vazia', pessoas: [], telasNoAr: 0, cheia: false }]

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body).toEqual([{ slug: 'vazia', nome: 'Vazia', pessoas: [], telasNoAr: 0, temSenha: false, cheia: false }])
    })

    it('temSenha vem do banco, não do SFU', async () => {
      const ip = ipDeTeste()
      await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ip)
        .send({ nome: 'Protegida', senha: 'segredo', seuNome: 'Ana' })
        .expect(201)

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body).toEqual([expect.objectContaining({ slug: 'protegida', temSenha: true })])
    })

    it('SFU caído devolve 503 sfu_indisponivel — lista vazia mentiria "não há salas"', async () => {
      sfu.deveFalhar = true

      const res = await request(app.getHttpServer()).get('/api/salas')

      expect(res.status).toBe(503)
      expect(res.body).toEqual({ erro: 'sfu_indisponivel' })
    })
  })

  describe('POST /api/salas', () => {
    it('cria a sala e devolve as credenciais do contrato', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Jogatina', seuNome: 'Ana' })
        .expect(201)

      expect(res.body).toMatchObject({ slug: 'jogatina', nomeDaSala: 'Jogatina', nome: 'Ana' })
      expect(res.body.identidade).toMatch(/^ana-[0-9a-f]{6}$/)
      expect(typeof res.body.token).toBe('string')
      expect(typeof res.body.urlSfu).toBe('string')

      expect(sfu.salasAtuais.some((s) => s.slug === 'jogatina')).toBe(true)
    })

    it('nome da sala inválido (só emoji) devolve 400 nome_da_sala_invalido', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: '🎮', seuNome: 'Ana' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ erro: 'nome_da_sala_invalido' })
    })

    it('seu nome vazio devolve 400 nome_invalido', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Jogatina', seuNome: '   ' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ erro: 'nome_invalido' })
    })

    it('slug repetido (já existe no SFU) devolve 409 sala_existe', async () => {
      const ip = ipDeTeste()
      await request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ip).send({ nome: 'Jogatina', seuNome: 'Ana' }).expect(201)

      const res = await request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ip).send({ nome: 'jogatina', seuNome: 'Bea' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ erro: 'sala_existe' })
    })

    it('teto global de 20 salas devolve 429 muitas_salas', async () => {
      sfu.salasAtuais = Array.from({ length: 20 }, (_, i) => ({ slug: `sala-${i}`, nome: `Sala ${i}`, pessoas: [], telasNoAr: 0, cheia: false }))

      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Mais uma', seuNome: 'Ana' })

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'muitas_salas' })
    })

    it('linha órfã do mesmo slug é sobrescrita — nome reusado não herda senha de sala morta', async () => {
      const ds = dataSource(app)
      await ds.query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['jogatina', cifrar('senha-antiga')])

      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Jogatina', seuNome: 'Ana' }) // sem senha nova
        .expect(201)
      expect(res.body.slug).toBe('jogatina')

      const linha = await ds.query(`SELECT * FROM salas WHERE slug = $1`, ['jogatina'])
      expect(linha).toHaveLength(0) // sem senha nova: a linha órfã some e não volta
    })

    it('linha órfã com senha nova: o hash antigo é substituído, não mantido', async () => {
      const ds = dataSource(app)
      await ds.query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['jogatina', cifrar('senha-antiga')])

      await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Jogatina', senha: 'senha-nova', seuNome: 'Ana' })
        .expect(201)

      const [linha] = await ds.query(`SELECT senha_hash FROM salas WHERE slug = $1`, ['jogatina'])
      expect(linha).toBeDefined()
      expect(confere('senha-antiga', linha.senha_hash)).toBe(false)
      expect(confere('senha-nova', linha.senha_hash)).toBe(true)
    })

    it('sala sem senha não grava linha no banco', async () => {
      await request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ipDeTeste()).send({ nome: 'Sem Segredo', seuNome: 'Ana' }).expect(201)

      const linha = await dataSource(app).query(`SELECT * FROM salas WHERE slug = $1`, ['sem-segredo'])
      expect(linha).toHaveLength(0)
    })

    it('sala com senha grava o hash, não a senha em texto', async () => {
      await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Com Segredo', senha: 'abacate', seuNome: 'Ana' })
        .expect(201)

      const [linha] = await dataSource(app).query(`SELECT senha_hash FROM salas WHERE slug = $1`, ['com-segredo'])
      expect(linha.senha_hash).not.toBe('abacate')
      expect(linha.senha_hash).toContain(':')
    })

    it('décima primeira criação no mesmo minuto devolve 429 espere', async () => {
      const ip = ipDeTeste()
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/salas')
          .set('X-Forwarded-For', ip)
          .send({ nome: `Sala Freio ${i}`, seuNome: 'Ana' })
          .expect(201)
      }

      const res = await request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ip).send({ nome: 'Sala Freio 11', seuNome: 'Ana' })

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'espere' })
    })
  })

  describe('POST /api/salas/:slug/entrar', () => {
    it('sala inexistente devolve 404 sala_nao_existe', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas/nao-existe/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ erro: 'sala_nao_existe' })
    })

    it('sala sem senha: entra só com o nome', async () => {
      sfu.salasAtuais = [{ slug: 'aberta', nome: 'Aberta', pessoas: [], telasNoAr: 0, cheia: false }]

      const res = await request(app.getHttpServer())
        .post('/api/salas/aberta/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })
        .expect(200)

      expect(res.body).toMatchObject({ slug: 'aberta', nomeDaSala: 'Aberta', nome: 'Ana' })
    })

    it('senha certa: entra', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', cifrar('correcthorse')])

      const res = await request(app.getHttpServer())
        .post('/api/salas/protegida/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ senha: 'correcthorse', seuNome: 'Ana' })

      expect(res.status).toBe(200)
    })

    it('senha errada devolve 401 senha_incorreta', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', cifrar('correcthorse')])

      const res = await request(app.getHttpServer())
        .post('/api/salas/protegida/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ senha: 'senha-errada', seuNome: 'Ana' })

      expect(res.status).toBe(401)
      expect(res.body).toEqual({ erro: 'senha_incorreta' })
    })

    it('sexta tentativa de senha errada no mesmo (ip, slug) devolve 429 espere', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', cifrar('correcthorse')])
      const ip = ipDeTeste()

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
        expect(res.status).toBe(401)
      }

      const sexta = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
      expect(sexta.status).toBe(429)
      expect(sexta.body).toEqual({ erro: 'espere' })
    })

    it('sala cheia (12 pessoas) devolve 409 sala_cheia', async () => {
      sfu.salasAtuais = [
        { slug: 'lotada', nome: 'Lotada', pessoas: Array.from({ length: 12 }, (_, i) => `p${i}`), telasNoAr: 0, cheia: true },
      ]

      const res = await request(app.getHttpServer())
        .post('/api/salas/lotada/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ erro: 'sala_cheia' })
    })

    it('trigésima primeira entrada no mesmo minuto devolve 429 espere', async () => {
      sfu.salasAtuais = [{ slug: 'aberta', nome: 'Aberta', pessoas: [], telasNoAr: 0, cheia: false }]
      const ip = ipDeTeste()
      for (let i = 0; i < 30; i++) {
        await request(app.getHttpServer()).post('/api/salas/aberta/entrar').set('X-Forwarded-For', ip).send({ seuNome: 'Ana' }).expect(200)
      }

      const res = await request(app.getHttpServer()).post('/api/salas/aberta/entrar').set('X-Forwarded-For', ip).send({ seuNome: 'Ana' })

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'espere' })
    })
  })
})
