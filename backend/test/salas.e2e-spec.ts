import { INestApplication } from '@nestjs/common'
import { TokenVerifier } from 'livekit-server-sdk'
import request from 'supertest'
import { cifrar, confere } from '../src/shared/senha'
import { slugDaSala } from '../src/shared/slug'
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

/** Decodifica e verifica a assinatura do JWT — a mesma checagem que o LiveKit faria. */
async function claimsDoToken(token: string) {
  const verificador = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)
  return verificador.verify(token)
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
      sfu.salasAtuais = [{ slug: 'jogatina', nomeNoSfu: 'jogatina-x1', nome: 'Jogatina', pessoas: ['Ana', 'Bea'], telasNoAr: 1, cheia: false }]

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body).toEqual([{ slug: 'jogatina', nome: 'Jogatina', pessoas: ['Ana', 'Bea'], telasNoAr: 1, temSenha: false, cheia: false }])
    })

    it('sala vazia (em carência) aparece na lista', async () => {
      sfu.salasAtuais = [{ slug: 'vazia', nomeNoSfu: 'vazia-x1', nome: 'Vazia', pessoas: [], telasNoAr: 0, cheia: false }]

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body).toEqual([{ slug: 'vazia', nome: 'Vazia', pessoas: [], telasNoAr: 0, temSenha: false, cheia: false }])
    })

    it('não expõe sala privada no saguão', async () => {
      sfu.salasAtuais = [
        { slug: 'publica', nomeNoSfu: 'publica-x1', nome: 'Pública', pessoas: [], telasNoAr: 0, cheia: false },
        {
          slug: 'secreta',
          nomeNoSfu: 'secreta-x1',
          nome: 'Secreta',
          privada: true,
          pessoas: ['Ana'],
          telasNoAr: 1,
          cheia: false,
        },
      ]

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body).toEqual([expect.objectContaining({ slug: 'publica' })])
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

  describe('GET /api/salas/nome-sugerido', () => {
    it('sugere um nome diferente dos usados, inclusive por sala privada', async () => {
      sfu.salasAtuais = [
        {
          slug: 'varanda-tranquila',
          nomeNoSfu: 'varanda-tranquila-x1',
          nome: 'Varanda Tranquila',
          privada: true,
          pessoas: [],
          telasNoAr: 0,
          cheia: false,
        },
      ]
      const sorteio = jest.spyOn(Math, 'random').mockReturnValue(0)

      try {
        const res = await request(app.getHttpServer()).get('/api/salas/nome-sugerido').expect(200)
        expect(res.body).toEqual({ nome: 'Varanda Tranquila 2' })
      } finally {
        sorteio.mockRestore()
      }
    })

    it('o dado nunca devolve de novo o nome que já está exibido', async () => {
      const sorteio = jest.spyOn(Math, 'random').mockReturnValue(0)

      try {
        const res = await request(app.getHttpServer())
          .get('/api/salas/nome-sugerido')
          .query({ nomeAtual: 'Varanda Tranquila' })
          .expect(200)
        expect(res.body).toEqual({ nome: 'Varanda Tranquila 2' })
      } finally {
        sorteio.mockRestore()
      }
    })
  })

  describe('POST /api/salas', () => {
    it('cria a sala e devolve as credenciais do contrato — o token aponta pro nome com nonce, não pro slug', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Jogatina', seuNome: 'Ana' })
        .expect(201)

      expect(res.body).toMatchObject({ slug: 'jogatina', nomeDaSala: 'Jogatina', nome: 'Ana' })
      expect(res.body.identidade).toMatch(/^ana-[0-9a-f]{6}$/)
      expect(typeof res.body.urlSfu).toBe('string')

      const salaCriada = sfu.salasAtuais.find((s) => s.slug === 'jogatina')
      expect(salaCriada).toBeDefined()
      // O nome interno no SFU carrega um nonce — nunca é igual ao slug público.
      expect(salaCriada!.nomeNoSfu).not.toBe('jogatina')

      const claims = await claimsDoToken(res.body.token)
      expect(claims.video?.room).toBe(salaCriada!.nomeNoSfu)
    })

    it('nome da sala inválido (só emoji) devolve 400 nome_da_sala_invalido', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: '🎮', seuNome: 'Ana' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ erro: 'nome_da_sala_invalido' })
    })

    it('sem nome, gera um automático de duas palavras — o nome ausente não é erro', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })
        .expect(201)

      expect(res.body.nomeDaSala.split(' ')).toHaveLength(2)
      expect(res.body.slug).toBe(slugDaSala(res.body.nomeDaSala))
    })

    it('nome não-string (ex.: número) continua devolvendo 400 nome_da_sala_invalido — só a ausência gera nome', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 123, seuNome: 'Ana' })

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

    it('senha não-string (ex.: PIN numérico) devolve 400, não sala aberta em silêncio', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Com PIN', senha: 1234, seuNome: 'Ana' })

      expect(res.status).toBe(400)
      expect(sfu.salasAtuais).toHaveLength(0)
    })

    it('privada não-booleana devolve 400, sem criar sala', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Escondida', privada: 'sim', seuNome: 'Ana' })

      expect(res.status).toBe(400)
      expect(sfu.salasAtuais).toHaveLength(0)
    })

    it('sala privada fica fora da lista, mas quem conhece o link entra com a senha', async () => {
      await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Escondida', privada: true, senha: 'segredo', seuNome: 'Ana' })
        .expect(201)

      expect(sfu.salasAtuais).toEqual([
        expect.objectContaining({ slug: 'escondida', privada: true }),
      ])
      await request(app.getHttpServer()).get('/api/salas').expect(200, [])

      const entrada = await request(app.getHttpServer())
        .post('/api/salas/escondida/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ senha: 'segredo', seuNome: 'Bea' })
        .expect(200)

      expect(entrada.body).toMatchObject({ slug: 'escondida', nomeDaSala: 'Escondida', nome: 'Bea' })
    })

    it('slug repetido (já existe no SFU) devolve 409 sala_existe', async () => {
      const ip = ipDeTeste()
      await request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ip).send({ nome: 'Jogatina', seuNome: 'Ana' }).expect(201)

      const res = await request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ip).send({ nome: 'jogatina', seuNome: 'Bea' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ erro: 'sala_existe' })
    })

    it('teto global de 20 salas devolve 429 muitas_salas', async () => {
      sfu.salasAtuais = Array.from({ length: 20 }, (_, i) => ({
        slug: `sala-${i}`,
        nomeNoSfu: `sala-${i}-x1`,
        nome: `Sala ${i}`,
        pessoas: [],
        telasNoAr: 0,
        cheia: false,
      }))

      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Mais uma', seuNome: 'Ana' })

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'muitas_salas' })
    })

    /**
     * Precedência entre dois erros que valem ao mesmo tempo. O use case valida o nome ANTES de
     * pedir `listarSalasSemCache()` — decisão explícita: quem mandou um nome impossível recebe
     * o código que diz o que fazer, e não um `muitas_salas` que some quando alguém sair de uma
     * sala. Sem esta guarda, inverter as duas checagens num refactor não quebra nada.
     */
    it('nome inválido vence muitas_salas quando os dois valem — a ordem das checagens é contrato', async () => {
      sfu.salasAtuais = Array.from({ length: 20 }, (_, i) => ({
        slug: `sala-${i}`,
        nomeNoSfu: `sala-${i}-x1`,
        nome: `Sala ${i}`,
        pessoas: [],
        telasNoAr: 0,
        cheia: false,
      }))

      const res = await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: '🎮', seuNome: 'Ana' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ erro: 'nome_da_sala_invalido' })
    })

    it('linha órfã do mesmo slug é sobrescrita — nome reusado não herda senha de sala morta', async () => {
      const ds = dataSource(app)
      await ds.query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['jogatina', await cifrar('senha-antiga')])

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
      await ds.query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['jogatina', await cifrar('senha-antiga')])

      await request(app.getHttpServer())
        .post('/api/salas')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ nome: 'Jogatina', senha: 'senha-nova', seuNome: 'Ana' })
        .expect(201)

      const [linha] = await ds.query(`SELECT senha_hash FROM salas WHERE slug = $1`, ['jogatina'])
      expect(linha).toBeDefined()
      await expect(confere('senha-antiga', linha.senha_hash)).resolves.toBe(false)
      await expect(confere('senha-nova', linha.senha_hash)).resolves.toBe(true)
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

    it('slug em caixa alta na URL casa com a sala em minúscula (mesma normalização de criar)', async () => {
      sfu.salasAtuais = [{ slug: 'jogatina', nomeNoSfu: 'jogatina-x1', nome: 'Jogatina', pessoas: [], telasNoAr: 0, cheia: false }]

      const res = await request(app.getHttpServer())
        .post('/api/salas/Jogatina/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })

      expect(res.status).toBe(200)
      expect(res.body.slug).toBe('jogatina')
    })

    it('sala sem senha: entra só com o nome, e o token aponta pro nome com nonce, não pro slug', async () => {
      sfu.salasAtuais = [{ slug: 'aberta', nomeNoSfu: 'aberta-x1', nome: 'Aberta', pessoas: [], telasNoAr: 0, cheia: false }]

      const res = await request(app.getHttpServer())
        .post('/api/salas/aberta/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })
        .expect(200)

      expect(res.body).toMatchObject({ slug: 'aberta', nomeDaSala: 'Aberta', nome: 'Ana' })

      const claims = await claimsDoToken(res.body.token)
      expect(claims.video?.room).toBe('aberta-x1')
    })

    it('senha certa: entra', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nomeNoSfu: 'protegida-x1', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', await cifrar('correcthorse')])

      const res = await request(app.getHttpServer())
        .post('/api/salas/protegida/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ senha: 'correcthorse', seuNome: 'Ana' })

      expect(res.status).toBe(200)
    })

    it('senha errada devolve 401 senha_incorreta', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nomeNoSfu: 'protegida-x1', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', await cifrar('correcthorse')])

      const res = await request(app.getHttpServer())
        .post('/api/salas/protegida/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ senha: 'senha-errada', seuNome: 'Ana' })

      expect(res.status).toBe(401)
      expect(res.body).toEqual({ erro: 'senha_incorreta' })
    })

    it('sexta tentativa de senha errada no mesmo (ip, slug) devolve 429 espere', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nomeNoSfu: 'protegida-x1', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', await cifrar('correcthorse')])
      const ip = ipDeTeste()

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
        expect(res.status).toBe(401)
      }

      const sexta = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
      expect(sexta.status).toBe(429)
      expect(sexta.body).toEqual({ erro: 'espere' })
    })

    it('acertar a senha não consome o freio de senha errada', async () => {
      sfu.salasAtuais = [{ slug: 'protegida', nomeNoSfu: 'protegida-x1', nome: 'Protegida', pessoas: [], telasNoAr: 0, cheia: false }]
      await dataSource(app).query(`INSERT INTO salas (slug, senha_hash) VALUES ($1, $2)`, ['protegida', await cifrar('correcthorse')])
      const ip = ipDeTeste()

      // 3 erradas (sobra orçamento: limite é 5)
      for (let i = 0; i < 3; i++) {
        const res = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
        expect(res.status).toBe(401)
      }

      // acerta — se isto consumisse o freio, as 2 erradas seguintes já estourariam o limite
      await request(app.getHttpServer())
        .post('/api/salas/protegida/entrar')
        .set('X-Forwarded-For', ip)
        .send({ senha: 'correcthorse', seuNome: 'Ana' })
        .expect(200)

      // mais 2 erradas: 3 + 2 = 5 erradas no total, ainda dentro do limite — as duas devem ser 401
      for (let i = 0; i < 2; i++) {
        const res = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
        expect(res.status).toBe(401)
      }

      // a 6ª errada (a acertada não contou) é que estoura
      const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const sexta = await request(app.getHttpServer()).post('/api/salas/protegida/entrar').set('X-Forwarded-For', ip).send({ senha: 'errada', seuNome: 'Ana' })
      expect(sexta.status).toBe(429)
      expect(sexta.body).toEqual({ erro: 'espere' })
      aviso.mockRestore()
    })

    it('sala cheia (30 pessoas) devolve 409 sala_cheia', async () => {
      sfu.salasAtuais = [
        {
          slug: 'lotada',
          nomeNoSfu: 'lotada-x1',
          nome: 'Lotada',
          pessoas: Array.from({ length: 30 }, (_, i) => `p${i}`),
          telasNoAr: 0,
          cheia: true,
        },
      ]

      const res = await request(app.getHttpServer())
        .post('/api/salas/lotada/entrar')
        .set('X-Forwarded-For', ipDeTeste())
        .send({ seuNome: 'Ana' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ erro: 'sala_cheia' })
    })

    it('trigésima primeira entrada no mesmo minuto devolve 429 espere', async () => {
      sfu.salasAtuais = [{ slug: 'aberta', nomeNoSfu: 'aberta-x1', nome: 'Aberta', pessoas: [], telasNoAr: 0, cheia: false }]
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
