import { describe, expect, it } from 'vitest'
import { formatarKbps, medirSaida, MEDIDA_VAZIA, type AmostraDeSaida } from '../src/sala/medidor'

/** Um `RTCStatsReport` de mentira: o de verdade é um Map, e este módulo só usa o `forEach`. */
function relatorio(...entradas: Record<string, unknown>[]) {
  return new Map(entradas.map((entrada, indice) => [`s${indice}`, entrada]))
}

function saida(parcial: Record<string, unknown> = {}) {
  return {
    type: 'outbound-rtp',
    kind: 'video',
    timestamp: 1000,
    bytesSent: 0,
    framesSent: 0,
    frameWidth: 1920,
    frameHeight: 1080,
    ...parcial,
  }
}

describe('medidor de saída', () => {
  it('sem outbound-rtp de vídeo devolve medida vazia e nenhuma amostra', () => {
    const { medida, amostra } = medirSaida(relatorio({ type: 'inbound-rtp', kind: 'video' }), null)
    expect(medida).toEqual(MEDIDA_VAZIA)
    expect(amostra).toBeNull()
  })

  it('a primeira leitura não tem taxa — só a partir da segunda existe intervalo', () => {
    const { medida, amostra } = medirSaida(relatorio(saida({ bytesSent: 12_500 })), null)
    expect(medida.kbps).toBeNull()
    expect(amostra).toEqual({ emMs: 1000, bytesEnviados: 12_500, quadrosEnviados: 0 })
  })

  it('calcula kbps a partir do que passou entre duas amostras', () => {
    const anterior: AmostraDeSaida = { emMs: 1000, bytesEnviados: 0, quadrosEnviados: 0 }
    // 250 000 bytes em 1 s = 2 000 kbps.
    const { medida } = medirSaida(relatorio(saida({ timestamp: 2000, bytesSent: 250_000 })), anterior)
    expect(medida.kbps).toBe(2000)
  })

  it('prefere o framesPerSecond que o navegador relata', () => {
    const anterior: AmostraDeSaida = { emMs: 1000, bytesEnviados: 0, quadrosEnviados: 0 }
    const { medida } = medirSaida(
      relatorio(saida({ timestamp: 2000, bytesSent: 1000, framesSent: 60, framesPerSecond: 14 })),
      anterior,
    )
    expect(medida.fps).toBe(14)
  })

  it('sem framesPerSecond, conta os quadros entre as amostras', () => {
    const anterior: AmostraDeSaida = { emMs: 1000, bytesEnviados: 0, quadrosEnviados: 100 }
    const { medida } = medirSaida(relatorio(saida({ timestamp: 3000, bytesSent: 1000, framesSent: 130 })), anterior)
    expect(medida.fps).toBe(15)
  })

  it('traduz o motivo da limitação do encoder', () => {
    const { medida } = medirSaida(relatorio(saida({ qualityLimitationReason: 'bandwidth' })), null)
    expect(medida.limitadoPor).toBe('banda')

    expect(medirSaida(relatorio(saida({ qualityLimitationReason: 'cpu' })), null).medida.limitadoPor).toBe('cpu')
    expect(medirSaida(relatorio(saida({ qualityLimitationReason: 'none' })), null).medida.limitadoPor).toBeNull()
  })

  it('reporta a resolução que está saindo', () => {
    const { medida } = medirSaida(relatorio(saida({ frameWidth: 1280, frameHeight: 720 })), null)
    expect([medida.largura, medida.altura]).toEqual([1280, 720])
  })

  it('com simulcast soma os bytes de todas as camadas e descreve a maior', () => {
    const anterior: AmostraDeSaida = { emMs: 1000, bytesEnviados: 0, quadrosEnviados: 0 }
    const { medida } = medirSaida(
      relatorio(
        saida({ timestamp: 2000, bytesSent: 200_000, frameWidth: 1920, frameHeight: 1080, framesPerSecond: 12 }),
        saida({ timestamp: 2000, bytesSent: 50_000, frameWidth: 640, frameHeight: 360, framesPerSecond: 30 }),
      ),
      anterior,
    )
    expect(medida.kbps).toBe(2000)
    expect(medida.altura).toBe(1080)
    expect(medida.fps).toBe(12)
  })

  it('aceita o campo mediaType, que é como navegadores antigos nomeiam o kind', () => {
    const { amostra } = medirSaida(
      relatorio({ type: 'outbound-rtp', mediaType: 'video', timestamp: 5, bytesSent: 7 }),
      null,
    )
    expect(amostra?.bytesEnviados).toBe(7)
  })
})

describe('formatação da taxa', () => {
  it('mostra travessão enquanto não há medida', () => {
    expect(formatarKbps(null)).toBe('—')
  })

  it('vira Mb/s acima de mil', () => {
    expect(formatarKbps(2500)).toBe('2.5 Mb/s')
    expect(formatarKbps(640)).toBe('640 kb/s')
  })
})
