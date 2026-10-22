process.env.LIVEKIT_API_SECRET ??= 'segredo-de-teste-da-assinatura'

import { assinarLink, lerAssinatura, VALIDADE_DA_ASSINATURA_S } from '../src/salas/assinatura'

const AGORA = Date.UTC(2026, 9, 21, 12, 0, 0)
const DIA_MS = 24 * 60 * 60 * 1000

describe('assinatura do link da Sala fixa', () => {
  const dados = { slug: 'eclipse-3', nome: 'Eclipse 3', privada: false }

  it('a assinatura recém-emitida confere e devolve nome e visibilidade', () => {
    const assinatura = assinarLink(dados, AGORA)

    expect(lerAssinatura('eclipse-3', assinatura, AGORA)).toEqual({ tipo: 'valida', nome: 'Eclipse 3', privada: false })
  })

  it('cabe numa URL: só base64url e um ponto, curta', () => {
    const assinatura = assinarLink({ slug: 'a', nome: 'x'.repeat(40), privada: true }, AGORA)

    expect(assinatura).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/)
    expect(assinatura.length).toBeLessThan(120)
  })

  it('vale por 7 dias de guarda mais um de folga, e depois vira vencida — sem perder o nome', () => {
    const assinatura = assinarLink({ ...dados, privada: true }, AGORA)

    expect(VALIDADE_DA_ASSINATURA_S).toBe(8 * 24 * 60 * 60)
    expect(lerAssinatura('eclipse-3', assinatura, AGORA + 8 * DIA_MS - 1000).tipo).toBe('valida')
    expect(lerAssinatura('eclipse-3', assinatura, AGORA + 8 * DIA_MS + 1000)).toEqual({
      tipo: 'vencida',
      nome: 'Eclipse 3',
      privada: true,
    })
  })

  it('não serve para outro slug', () => {
    const assinatura = assinarLink(dados, AGORA)

    expect(lerAssinatura('eclipse-4', assinatura, AGORA)).toEqual({ tipo: 'invalida' })
  })

  it('adulterar a carga (nome, visibilidade ou prazo) invalida', () => {
    const [, mac] = assinarLink(dados, AGORA).split('.')
    const forjada = (carga: unknown[]) => `${Buffer.from(JSON.stringify(carga)).toString('base64url')}.${mac}`
    const ate = Math.floor(AGORA / 1000) + VALIDADE_DA_ASSINATURA_S

    expect(lerAssinatura('eclipse-3', forjada(['Eclipse 3', 1, ate]), AGORA)).toEqual({ tipo: 'invalida' })
    expect(lerAssinatura('eclipse-3', forjada(['Outra', 0, ate]), AGORA)).toEqual({ tipo: 'invalida' })
    expect(lerAssinatura('eclipse-3', forjada(['Eclipse 3', 0, ate + 3600]), AGORA)).toEqual({ tipo: 'invalida' })
  })

  it('lixo, pedaços faltando e MAC cortado são inválidos, sem lançar', () => {
    const assinatura = assinarLink(dados, AGORA)

    for (const ruim of ['', 'abc', '.', 'a.b.c', assinatura.slice(0, -2), `${assinatura}x`, 'bm9wZQ.AAAA']) {
      expect(lerAssinatura('eclipse-3', ruim, AGORA)).toEqual({ tipo: 'invalida' })
    }
  })

  it('a chave sai do segredo do LiveKit: trocar o segredo invalida os links antigos', () => {
    const assinatura = assinarLink(dados, AGORA)
    const segredo = process.env.LIVEKIT_API_SECRET
    jest.isolateModules(() => {
      process.env.LIVEKIT_API_SECRET = 'outro-segredo'
      // env() é memoizado por módulo: um registro novo de módulos relê o segredo.
      const { lerAssinatura: lerComOutroSegredo } = require('../src/salas/assinatura') as typeof import('../src/salas/assinatura')
      expect(lerComOutroSegredo('eclipse-3', assinatura, AGORA)).toEqual({ tipo: 'invalida' })
    })
    process.env.LIVEKIT_API_SECRET = segredo
  })
})
