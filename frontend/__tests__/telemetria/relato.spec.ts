import { describe, expect, it } from 'vitest'
import { amostraVaziaDoEspectador } from '../../src/telemetria/amostra'
import {
  desempacotarRelato,
  empacotarRelato,
  sumiu,
  TOPICO_DA_TELEMETRIA,
  VALIDADE_DO_RELATO_MS,
} from '../../src/telemetria/relato'

function bytes(valor: unknown): Uint8Array {
  return new TextEncoder().encode(typeof valor === 'string' ? valor : JSON.stringify(valor))
}

const AMOSTRA = {
  ...amostraVaziaDoEspectador(1_700_000_000_000),
  fpsDecodificado: 29,
  fpsRecebido: 30,
  kbps: 2800,
  quadrosDescartados: 3,
  freezes: { quantidade: 1, duracaoMs: 600 },
  desvioEntreQuadrosMs: 4.2,
  atrasoDoBufferMs: 45,
  perda: 0.5,
  jitterMs: 3,
  largura: 1920,
  altura: 1080,
  codec: 'VP9',
  decoder: 'FFmpeg',
  decoderEmHardware: false,
  rtt: 40,
  protocolo: 'udp' as const,
}

describe('relato do espectador', () => {
  it('vai e volta inteiro pelo fio', () => {
    expect(desempacotarRelato(empacotarRelato(AMOSTRA))).toEqual(AMOSTRA)
  })

  it('o tópico é próprio, para o chat e o relato não se confundirem', () => {
    expect(TOPICO_DA_TELEMETRIA).toBe('telemetria')
  })

  it('recusa o que não é relato', () => {
    expect(desempacotarRelato(bytes('{{{'))).toBeNull()
    expect(desempacotarRelato(bytes(null))).toBeNull()
    expect(desempacotarRelato(bytes([1]))).toBeNull()
    expect(desempacotarRelato(bytes({ nome: 'Bia', texto: 'oi', ts: 1 }))).toBeNull()
    expect(desempacotarRelato(bytes({ v: 99, emMs: 1 }))).toBeNull()
  })

  it('campo com tipo errado vira null; texto gigante é truncado', () => {
    const relato = desempacotarRelato(
      bytes({ ...AMOSTRA, v: 1, fpsDecodificado: 'muitos', protocolo: 'pombo', decoder: 'x'.repeat(500) }),
    )
    expect(relato?.fpsDecodificado).toBeNull()
    expect(relato?.protocolo).toBeNull()
    expect(relato?.decoder).toHaveLength(60)
    expect(relato?.kbps).toBe(2800)
  })

  it('os contadores compostos são saneados campo a campo', () => {
    const relato = desempacotarRelato(bytes({ ...AMOSTRA, v: 1, freezes: { quantidade: 'a' }, quadrosDescartados: -1 }))
    expect(relato?.freezes).toEqual({ quantidade: 0, duracaoMs: 0 })
    expect(relato?.quadrosDescartados).toBe(0)
  })

  it('sem emMs usável, carimba a chegada', () => {
    const antes = Date.now()
    const relato = desempacotarRelato(bytes({ ...AMOSTRA, v: 1, emMs: 'agora' }))
    expect(relato?.emMs).toBeGreaterThanOrEqual(antes)
  })

  it('um espectador sumiu quando o relato passa da validade', () => {
    expect(VALIDADE_DO_RELATO_MS).toBe(6000)
    expect(sumiu({ vistoEm: 10_000 }, 10_000 + VALIDADE_DO_RELATO_MS)).toBe(false)
    expect(sumiu({ vistoEm: 10_000 }, 10_000 + VALIDADE_DO_RELATO_MS + 1)).toBe(true)
  })
})
