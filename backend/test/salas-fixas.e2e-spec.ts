import { INestApplication } from '@nestjs/common'
import { TokenVerifier } from 'livekit-server-sdk'
import request from 'supertest'
import { assinarLink } from '../src/salas/assinatura'
import { LivekitTokenProvider } from '../src/shared/livekit/livekit-token.provider'
import { SalaNoSfu } from '../src/shared/livekit/livekit-room.provider'
import { LivekitRoomProviderFalso } from './salas-fake'
import { criarApp } from './helpers'

/** Um IP por teste, pelo mesmo motivo de salas.e2e-spec.ts: o freio é por IP e da suíte toda. */
let proximoIp = 1
function ipDeTeste(): string {
  proximoIp += 1
  return `10.1.0.${proximoIp}`
}

async function salaDoToken(token: string): Promise<string | undefined> {
  const claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(token)
  return claims.video?.room
}

function sala(molde: Partial<SalaNoSfu> & Pick<SalaNoSfu, 'slug'>): SalaNoSfu {
  return { nomeNoSfu: `${molde.slug}-x1`, nome: molde.slug, pessoas: [], telasNoAr: 0, cheia: false, ...molde }
}

const OITO_DIAS_MS = 8 * 24 * 60 * 60 * 1000

describe('salas fixas (ADR 0013)', () => {
  let app: INestApplication
  let sfu: LivekitRoomProviderFalso

  beforeAll(async () => {
    sfu = new LivekitRoomProviderFalso()
    app = await criarApp({ roomProvider: sfu })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    sfu.salasAtuais = []
    sfu.presentes = {}
    sfu.metadataGravado = {}
    sfu.deveFalhar = false
    sfu.atrasoDeCriarMs = 0
  })

  function criar(corpo: Record<string, unknown>, ip = ipDeTeste()) {
    return request(app.getHttpServer()).post('/api/salas').set('X-Forwarded-For', ip).send({ seuNome: 'Ana', ...corpo })
  }

  function entrar(slug: string, corpo: Record<string, unknown> = {}, ip = ipDeTeste()) {
    return request(app.getHttpServer())
      .post(`/api/salas/${slug}/entrar`)
      .set('X-Forwarded-For', ip)
      .send({ seuNome: 'Bea', ...corpo })
  }

  describe('criar', () => {
    it('sem dizer nada, a Sala nasce fixa e as credenciais trazem a assinatura do link', async () => {
      const res = await criar({ nome: 'Eclipse' }).expect(201)

      expect(res.body).toMatchObject({ slug: 'eclipse', fixa: true, privada: false })
      expect(res.body.assinatura).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/)
      expect(sfu.salasAtuais[0]).toMatchObject({ slug: 'eclipse', fixa: true })
    })

    it('"Apagar quando todos saírem" (fixa: false) faz a efêmera de sempre, sem assinatura', async () => {
      const res = await criar({ nome: 'Rapidinha', fixa: false }).expect(201)

      expect(res.body).toMatchObject({ fixa: false, assinatura: null })
      expect(sfu.salasAtuais[0]).toMatchObject({ fixa: false })
    })

    it('fixa não-booleana devolve 400, sem criar sala', async () => {
      await criar({ nome: 'Talvez', fixa: 'sim' }).expect(400)
      expect(sfu.salasAtuais).toHaveLength(0)
    })

    it('o nome de uma Sala adormecida continua ocupado', async () => {
      sfu.salasAtuais = [sala({ slug: 'eclipse', nome: 'Eclipse', fixa: true })]

      const res = await criar({ nome: 'Eclipse' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ erro: 'sala_existe' })
    })
  })

  describe('tetos', () => {
    it('as adormecidas não contam nas 20: com 19 acordadas e 50 guardadas, ainda nasce Sala', async () => {
      sfu.salasAtuais = [
        ...Array.from({ length: 19 }, (_, i) => sala({ slug: `viva-${i}`, pessoas: ['Ana'] })),
        ...Array.from({ length: 50 }, (_, i) => sala({ slug: `dormindo-${i}`, fixa: true })),
      ]

      await criar({ nome: 'Mais uma' }).expect(201)
    })

    it('20 acordadas barram a nova Sala com 429 muitas_salas', async () => {
      sfu.salasAtuais = Array.from({ length: 20 }, (_, i) => sala({ slug: `viva-${i}`, pessoas: ['Ana'], fixa: true }))

      const res = await criar({ nome: 'Mais uma' })

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'muitas_salas' })
    })

    it('200 adormecidas barram só a fixa (429 muitas_guardadas); a efêmera ainda nasce', async () => {
      sfu.salasAtuais = Array.from({ length: 200 }, (_, i) => sala({ slug: `dormindo-${i}`, fixa: true }))

      const fixa = await criar({ nome: 'Guardada' })
      expect(fixa.status).toBe(429)
      expect(fixa.body).toEqual({ erro: 'muitas_guardadas' })

      await criar({ nome: 'Passageira', fixa: false }).expect(201)
    })
  })

  describe('saguão', () => {
    it('lista as acordadas e a efêmera na carência, mas não a adormecida', async () => {
      sfu.salasAtuais = [
        sala({ slug: 'com-gente', fixa: true, pessoas: ['Ana'] }),
        sala({ slug: 'carencia', fixa: false }),
        sala({ slug: 'adormecida', fixa: true }),
      ]

      const res = await request(app.getHttpServer()).get('/api/salas').expect(200)

      expect(res.body.map((item: { slug: string }) => item.slug)).toEqual(['com-gente', 'carencia'])
    })
  })

  describe('entrar pelo link', () => {
    it('Sala adormecida no SFU: entra pelo slug, mesmo sem assinatura, e recebe uma assinatura nova', async () => {
      sfu.salasAtuais = [sala({ slug: 'eclipse', nome: 'Eclipse', fixa: true })]

      const res = await entrar('eclipse').expect(200)

      expect(res.body).toMatchObject({ slug: 'eclipse', nomeDaSala: 'Eclipse', fixa: true })
      expect(typeof res.body.assinatura).toBe('string')
      expect(await salaDoToken(res.body.token)).toBe('eclipse-x1')
    })

    it('SFU reiniciado: a assinatura recria a Sala com mesmo slug, nome e visibilidade, em encarnação nova', async () => {
      const criada = await criar({ nome: 'Escondida', privada: true }).expect(201)
      const { slug, assinatura } = criada.body as { slug: string; assinatura: string }
      const encarnacaoAntiga = sfu.salasAtuais[0].nomeNoSfu

      sfu.salasAtuais = [] // o SFU perdeu tudo

      const res = await entrar(slug, { assinatura }).expect(200)

      expect(res.body).toMatchObject({ slug, nomeDaSala: 'Escondida', privada: true, fixa: true })
      expect(sfu.salasAtuais).toEqual([expect.objectContaining({ slug, nome: 'Escondida', privada: true, fixa: true })])
      // Nonce novo: o token antigo aponta para uma encarnação que não existe mais.
      expect(sfu.salasAtuais[0].nomeNoSfu).not.toBe(encarnacaoAntiga)
      expect(await salaDoToken(res.body.token)).toBe(sfu.salasAtuais[0].nomeNoSfu)
      expect(await salaDoToken(criada.body.token)).toBe(encarnacaoAntiga)
    })

    it('o grupo chegando junto depois do reinício faz uma encarnação só', async () => {
      const assinatura = assinarLink({ slug: 'eclipse', nome: 'Eclipse', privada: false })
      sfu.atrasoDeCriarMs = 50

      const respostas = await Promise.all([
        entrar('eclipse', { assinatura }),
        entrar('eclipse', { assinatura }),
        entrar('eclipse', { assinatura }),
      ])

      expect(respostas.map((r) => r.status)).toEqual([200, 200, 200])
      expect(sfu.salasAtuais).toHaveLength(1)
      const salas = await Promise.all(respostas.map((r) => salaDoToken(r.body.token)))
      expect(new Set(salas).size).toBe(1)
    })

    it('sem assinatura, a Sala que não existe é o 404 de sempre e nada nasce', async () => {
      const res = await entrar('eclipse')

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ erro: 'sala_nao_existe' })
      expect(sfu.salasAtuais).toHaveLength(0)
    })

    it('assinatura adulterada ou de outro slug: 404 assinatura_invalida e nada nasce', async () => {
      const assinatura = assinarLink({ slug: 'eclipse', nome: 'Eclipse', privada: false })
      const [carga, mac] = assinatura.split('.')
      const outraCarga = Buffer.from(JSON.stringify(['Eclipse', 1, JSON.parse(Buffer.from(carga, 'base64url').toString())[2]])).toString('base64url')

      for (const [slug, ruim] of [
        ['eclipse', `${outraCarga}.${mac}`],
        ['outra-sala', assinatura],
        ['eclipse', 'lixo'],
      ]) {
        const res = await entrar(slug, { assinatura: ruim })
        expect(res.status).toBe(404)
        expect(res.body).toEqual({ erro: 'assinatura_invalida' })
      }
      expect(sfu.salasAtuais).toHaveLength(0)
    })

    it('assinatura vencida: 404 sala_expirada e nada nasce', async () => {
      const assinatura = assinarLink({ slug: 'eclipse', nome: 'Eclipse', privada: false }, Date.now() - OITO_DIAS_MS - 60_000)

      const res = await entrar('eclipse', { assinatura })

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ erro: 'sala_expirada' })
      expect(sfu.salasAtuais).toHaveLength(0)
    })

    it('recriar pelo link paga o freio de criar: a 11ª recriação no minuto espera', async () => {
      const ip = ipDeTeste()
      for (let i = 0; i < 10; i++) {
        const slug = `volta-${i}`
        await entrar(slug, { assinatura: assinarLink({ slug, nome: `Volta ${i}`, privada: false }) }, ip).expect(200)
      }

      const res = await entrar('volta-10', { assinatura: assinarLink({ slug: 'volta-10', nome: 'Volta 10', privada: false }) }, ip)

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'espere' })
    })

    it('recriar respeita o teto das adormecidas', async () => {
      sfu.salasAtuais = Array.from({ length: 200 }, (_, i) => sala({ slug: `dormindo-${i}`, fixa: true }))

      const res = await entrar('eclipse', { assinatura: assinarLink({ slug: 'eclipse', nome: 'Eclipse', privada: false }) })

      expect(res.status).toBe(429)
      expect(res.body).toEqual({ erro: 'muitas_guardadas' })
    })
  })

  describe('PATCH /api/salas/:slug — nome e visibilidade', () => {
    /** Cria a Sala e põe quem criou dentro dela no SFU, com a identidade do token. */
    async function salaComAna(corpo: Record<string, unknown>) {
      const res = await criar(corpo).expect(201)
      const { token, identidade, slug } = res.body as { token: string; identidade: string; slug: string }
      const nomeNoSfu = sfu.salasAtuais.find((s) => s.slug === slug)!.nomeNoSfu
      sfu.presentes[nomeNoSfu] = [{ identidade, nome: 'Ana', publicandoTela: false }]
      return { token, slug, nomeNoSfu }
    }

    function ajustar(slug: string, token: string | null, corpo: Record<string, unknown>) {
      const pedido = request(app.getHttpServer()).patch(`/api/salas/${slug}`).set('X-Forwarded-For', ipDeTeste())
      if (token) pedido.set('Authorization', `Bearer ${token}`)
      return pedido.send(corpo)
    }

    it('quem está dentro muda o nome: mesma encarnação, slug novo, assinatura nova no metadata', async () => {
      const { token, nomeNoSfu } = await salaComAna({ nome: 'Eclipse' })

      const res = await ajustar('eclipse', token, { nome: 'Lua Cheia' }).expect(200)

      expect(res.body).toMatchObject({ slug: 'lua-cheia', nomeDaSala: 'Lua Cheia', privada: false, fixa: true })
      expect(typeof res.body.assinatura).toBe('string')
      expect(sfu.metadataGravado[nomeNoSfu]).toEqual({
        slug: 'lua-cheia',
        nome: 'Lua Cheia',
        privada: false,
        fixa: true,
        assinatura: res.body.assinatura,
        anteriores: ['eclipse'],
      })
      expect(sfu.salasAtuais).toHaveLength(1)
    })

    it('pública que vira privada ganha sufixo; privada que muda de nome guarda o mesmo sufixo', async () => {
      const { token } = await salaComAna({ nome: 'Eclipse' })

      const privada = await ajustar('eclipse', token, { privada: true }).expect(200)
      expect(privada.body.slug).toMatch(/^eclipse-[0-9a-f]{6}$/)
      const sufixo = privada.body.slug.slice(-6)

      const renomeada = await ajustar(privada.body.slug, token, { nome: 'Lua' }).expect(200)
      expect(renomeada.body).toMatchObject({ slug: `lua-${sufixo}`, privada: true })
    })

    it('sem token, com token de outra encarnação ou sem estar dentro agora: 403 fora_da_sala', async () => {
      const { nomeNoSfu } = await salaComAna({ nome: 'Eclipse' })
      const tokens = new LivekitTokenProvider()

      const semToken = await ajustar('eclipse', null, { nome: 'Lua' })
      const deOutra = await ajustar('eclipse', await tokens.emitir('eclipse-velha', 'ana-a1b2c3', 'Ana'), { nome: 'Lua' })
      const ausente = await ajustar('eclipse', await tokens.emitir(nomeNoSfu, 'bea-999999', 'Bea'), { nome: 'Lua' })

      for (const res of [semToken, deOutra, ausente]) {
        expect(res.status).toBe(403)
        expect(res.body).toEqual({ erro: 'fora_da_sala' })
      }
      expect(sfu.metadataGravado).toEqual({})
    })

    it('nome que já é de outra Sala viva: 409 sala_existe', async () => {
      const { token } = await salaComAna({ nome: 'Eclipse' })
      sfu.salasAtuais.push(sala({ slug: 'lua', fixa: true }))

      const res = await ajustar('eclipse', token, { nome: 'Lua' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ erro: 'sala_existe' })
    })

    it('nome inválido: 400; Sala inexistente: 404', async () => {
      const { token } = await salaComAna({ nome: 'Eclipse' })

      expect((await ajustar('eclipse', token, { nome: '🎮' })).body).toEqual({ erro: 'nome_da_sala_invalido' })
      expect((await ajustar('nada', token, { nome: 'Lua' })).status).toBe(404)
    })

    it('o link assinado de antes da troca leva à Sala renomeada; o slug antigo sem assinatura, não', async () => {
      const criada = await criar({ nome: 'Eclipse' }).expect(201)
      const linkAntigo = criada.body.assinatura as string
      const nomeNoSfu = sfu.salasAtuais[0].nomeNoSfu
      sfu.presentes[nomeNoSfu] = [{ identidade: criada.body.identidade, nome: 'Ana', publicandoTela: false }]
      await ajustar('eclipse', criada.body.token, { nome: 'Lua', privada: true }).expect(200)

      const comLink = await entrar('eclipse', { assinatura: linkAntigo }).expect(200)
      expect(comLink.body).toMatchObject({ nomeDaSala: 'Lua', privada: true })
      expect(comLink.body.slug).toMatch(/^lua-[0-9a-f]{6}$/)
      expect(await salaDoToken(comLink.body.token)).toBe(nomeNoSfu)
      expect(sfu.salasAtuais).toHaveLength(1)

      const semLink = await entrar('eclipse')
      expect(semLink.status).toBe(404)
      expect(semLink.body).toEqual({ erro: 'sala_nao_existe' })
    })
  })
})
