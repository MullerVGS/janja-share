import { describe, expect, it } from 'vitest'
import {
  lerAmostraDoEmissor,
  lerAmostraDoEspectador,
  type AmostraDoEmissor,
  type AmostraDoEspectador,
} from '../../src/telemetria/amostra'

/** Um `RTCStatsReport` de mentira: o de verdade é um Map, e os normalizadores só usam o `forEach`. */
function relatorio(...entradas: Record<string, unknown>[]) {
  return new Map(entradas.map((entrada, indice) => [(entrada.id as string | undefined) ?? `s${indice}`, entrada]))
}

function saida(parcial: Record<string, unknown> = {}) {
  return {
    type: 'outbound-rtp',
    kind: 'video',
    timestamp: 1000,
    bytesSent: 0,
    framesEncoded: 0,
    totalEncodeTime: 0,
    frameWidth: 1920,
    frameHeight: 1080,
    qualityLimitationReason: 'none',
    qualityLimitationDurations: { none: 10, cpu: 0, bandwidth: 0, other: 0 },
    ...parcial,
  }
}

function entrada(parcial: Record<string, unknown> = {}) {
  return {
    type: 'inbound-rtp',
    kind: 'video',
    timestamp: 1000,
    bytesReceived: 0,
    framesDecoded: 0,
    framesReceived: 0,
    framesDropped: 0,
    packetsReceived: 0,
    packetsLost: 0,
    freezeCount: 0,
    totalFreezesDuration: 0,
    jitterBufferDelay: 0,
    jitterBufferEmittedCount: 0,
    totalInterFrameDelay: 0,
    totalSquaredInterFrameDelay: 0,
    frameWidth: 1280,
    frameHeight: 720,
    ...parcial,
  }
}

const REDE_UDP = [
  { id: 'par', type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'loc', currentRoundTripTime: 0.042, availableOutgoingBitrate: 8_000_000 },
  { id: 'loc', type: 'local-candidate', protocol: 'udp', candidateType: 'srflx' },
]

describe('amostra do emissor', () => {
  it('sem outbound-rtp de vídeo devolve a amostra vazia, datada, e nenhuma base', () => {
    const { amostra, base } = lerAmostraDoEmissor(relatorio({ type: 'inbound-rtp', kind: 'video' }), null, true)
    expect(base).toBeNull()
    expect(amostra.kbps).toBeNull()
    expect(amostra.fpsCodificado).toBeNull()
    expect(amostra.codec).toBeNull()
    expect(amostra.ativo).toBe(true)
  })

  it('a primeira leitura não tem taxa nenhuma — taxa é diferença entre duas amostras', () => {
    const { amostra, base } = lerAmostraDoEmissor(relatorio(saida({ bytesSent: 12_500, framesEncoded: 30 })), null, true)
    expect(amostra.kbps).toBeNull()
    expect(amostra.fpsCodificado).toBeNull()
    expect(amostra.encodeMsPorQuadro).toBeNull()
    expect(base).toMatchObject({ emMs: 1000, bytes: 12_500, quadros: 30 })
  })

  it('kbps, fps codificado e ms de encode por quadro saem da diferença entre amostras', () => {
    const primeira = lerAmostraDoEmissor(relatorio(saida()), null, true)
    // 250 000 bytes em 1 s = 2 000 kbps; 30 quadros em 1 s; 0,24 s gastos em 30 quadros = 8 ms/quadro.
    const { amostra } = lerAmostraDoEmissor(
      relatorio(saida({ timestamp: 2000, bytesSent: 250_000, framesEncoded: 30, totalEncodeTime: 0.24 })),
      primeira.base,
      true,
    )
    expect(amostra.kbps).toBe(2000)
    expect(amostra.fpsCodificado).toBe(30)
    expect(amostra.encodeMsPorQuadro).toBe(8)
  })

  it('prefere o framesPerSecond relatado pelo navegador quando ele existe', () => {
    const primeira = lerAmostraDoEmissor(relatorio(saida()), null, true)
    const { amostra } = lerAmostraDoEmissor(
      relatorio(saida({ timestamp: 2000, framesEncoded: 60, framesPerSecond: 14 })),
      primeira.base,
      true,
    )
    expect(amostra.fpsCodificado).toBe(14)
  })

  it('separa o fps da captura (media-source) do fps codificado (outbound-rtp)', () => {
    const { amostra } = lerAmostraDoEmissor(
      relatorio(
        saida({ framesPerSecond: 12 }),
        { type: 'media-source', kind: 'video', framesPerSecond: 2, width: 2560, height: 1440 },
      ),
      null,
      true,
    )
    expect(amostra.fpsCodificado).toBe(12)
    expect(amostra.fpsCaptura).toBe(2)
    expect([amostra.larguraDaCaptura, amostra.alturaDaCaptura]).toEqual([2560, 1440])
  })

  it('traduz o motivo da limitação e o tempo acumulado por motivo', () => {
    const { amostra } = lerAmostraDoEmissor(
      relatorio(
        saida({
          qualityLimitationReason: 'bandwidth',
          qualityLimitationDurations: { none: 50, cpu: 10, bandwidth: 40, other: 0 },
          qualityLimitationResolutionChanges: 3,
        }),
      ),
      null,
      true,
    )
    expect(amostra.limitadoPor).toBe('banda')
    expect(amostra.limitacaoSegundos).toEqual({ nenhuma: 50, cpu: 10, banda: 40, outro: 0 })
    expect(amostra.mudancasDeResolucao).toBe(3)

    expect(lerAmostraDoEmissor(relatorio(saida({ qualityLimitationReason: 'cpu' })), null, true).amostra.limitadoPor).toBe('cpu')
    expect(lerAmostraDoEmissor(relatorio(saida({ qualityLimitationReason: 'other' })), null, true).amostra.limitadoPor).toBe('outro')
    expect(lerAmostraDoEmissor(relatorio(saida()), null, true).amostra.limitadoPor).toBeNull()
  })

  it('dynacast pausado chega como `ativo: false`, não como zero fps', () => {
    const primeira = lerAmostraDoEmissor(relatorio(saida()), null, false)
    const { amostra } = lerAmostraDoEmissor(relatorio(saida({ timestamp: 2000 })), primeira.base, false)
    expect(amostra.ativo).toBe(false)
    expect(amostra.fpsCodificado).toBe(0)
  })

  it('lê encoder, codec e escalabilidade', () => {
    const { amostra } = lerAmostraDoEmissor(
      relatorio(
        saida({
          codecId: 'c1',
          encoderImplementation: 'libvpx',
          powerEfficientEncoder: false,
          scalabilityMode: 'L1T2',
          targetBitrate: 2_500_000,
        }),
        { id: 'c1', type: 'codec', mimeType: 'video/VP9', sdpFmtpLine: 'profile-id=0' },
      ),
      null,
      true,
    )
    expect(amostra.codec).toBe('VP9')
    expect(amostra.perfilDoCodec).toBe('profile-id=0')
    expect(amostra.encoder).toBe('libvpx')
    expect(amostra.encoderEmHardware).toBe(false)
    expect(amostra.escalabilidade).toBe('L1T2')
    expect(amostra.alvoKbps).toBe(2500)
  })

  it('rede: RTT e perda do remote-inbound-rtp, banda e protocolo do par de candidatos nominado', () => {
    const { amostra } = lerAmostraDoEmissor(
      relatorio(
        saida(),
        { type: 'remote-inbound-rtp', kind: 'video', roundTripTime: 0.05, fractionLost: 0.02, jitter: 0.003 },
        ...REDE_UDP,
      ),
      null,
      true,
    )
    expect(amostra.rtt).toBe(50)
    expect(amostra.perda).toBe(2)
    expect(amostra.jitterMs).toBe(3)
    expect(amostra.bandaDisponivelKbps).toBe(8000)
    expect(amostra.protocolo).toBe('udp')
    expect(amostra.tipoDeCandidato).toBe('srflx')
  })

  it('sem remote-inbound-rtp, o RTT vem do par de candidatos; TCP é reconhecido', () => {
    const { amostra } = lerAmostraDoEmissor(
      relatorio(
        saida(),
        { id: 'par', type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'loc', currentRoundTripTime: 0.12 },
        { id: 'loc', type: 'local-candidate', protocol: 'tcp', candidateType: 'relay' },
        { id: 'morto', type: 'candidate-pair', nominated: false, state: 'failed', localCandidateId: 'x' },
      ),
      null,
      true,
    )
    expect(amostra.rtt).toBe(120)
    expect(amostra.protocolo).toBe('tcp')
    expect(amostra.perda).toBeNull()
  })

  it('robustez: keyframes, PLI, NACK e FIR acumulados', () => {
    const { amostra } = lerAmostraDoEmissor(
      relatorio(saida({ keyFramesEncoded: 4, pliCount: 2, nackCount: 7, firCount: 1 })),
      null,
      true,
    )
    expect(amostra.robustez).toEqual({ quadrosChave: 4, pli: 2, nack: 7, fir: 1 })
  })

  it('com mais de uma camada soma os bytes e descreve a maior', () => {
    const primeira = lerAmostraDoEmissor(relatorio(saida(), saida({ frameHeight: 360 })), null, true)
    const { amostra } = lerAmostraDoEmissor(
      relatorio(
        saida({ timestamp: 2000, bytesSent: 200_000, framesPerSecond: 12 }),
        saida({ timestamp: 2000, bytesSent: 50_000, frameWidth: 640, frameHeight: 360, framesPerSecond: 30 }),
      ),
      primeira.base,
      true,
    )
    expect(amostra.kbps).toBe(2000)
    expect([amostra.largura, amostra.altura, amostra.fpsCodificado]).toEqual([1920, 1080, 12])
  })

  it('a amostra é um objeto fechado, sem campos do RTCStats cru', () => {
    const { amostra } = lerAmostraDoEmissor(relatorio(saida({ ssrc: 123, mid: '0' })), null, true)
    expect(amostra).not.toHaveProperty('ssrc')
    expect(amostra).not.toHaveProperty('mid')
    const chaves: (keyof AmostraDoEmissor)[] = ['emMs', 'fpsCodificado', 'fpsCaptura', 'kbps', 'largura', 'altura', 'limitadoPor', 'encodeMsPorQuadro', 'ativo', 'codec', 'encoder', 'rtt', 'perda', 'protocolo']
    for (const chave of chaves) expect(amostra).toHaveProperty(chave)
  })
})

describe('amostra do espectador', () => {
  it('sem inbound-rtp de vídeo devolve a amostra vazia e nenhuma base', () => {
    const { amostra, base } = lerAmostraDoEspectador(relatorio({ type: 'outbound-rtp', kind: 'video' }), null)
    expect(base).toBeNull()
    expect(amostra.fpsDecodificado).toBeNull()
    expect(amostra.largura).toBeNull()
  })

  it('fps decodificado e recebido, kbps e descartados por diferença; a primeira leitura não tem taxa', () => {
    const primeira = lerAmostraDoEspectador(relatorio(entrada({ framesDecoded: 100, framesReceived: 100 })), null)
    expect(primeira.amostra.fpsDecodificado).toBeNull()

    const { amostra } = lerAmostraDoEspectador(
      relatorio(entrada({ timestamp: 3000, bytesReceived: 500_000, framesDecoded: 150, framesReceived: 160, framesDropped: 10 })),
      primeira.base,
    )
    expect(amostra.fpsDecodificado).toBe(25)
    expect(amostra.fpsRecebido).toBe(30)
    expect(amostra.kbps).toBe(2000)
    expect(amostra.quadrosDescartados).toBe(10)
  })

  it('freezes acumulados em quantidade e milissegundos', () => {
    const { amostra } = lerAmostraDoEspectador(relatorio(entrada({ freezeCount: 3, totalFreezesDuration: 4.25 })), null)
    expect(amostra.freezes).toEqual({ quantidade: 3, duracaoMs: 4250 })
  })

  it('desvio entre quadros: variância da diferença dos totais, em ms', () => {
    const primeira = lerAmostraDoEspectador(relatorio(entrada()), null)
    // 4 quadros com intervalos de 20, 40, 20, 40 ms: média 30 ms, desvio 10 ms.
    const { amostra } = lerAmostraDoEspectador(
      relatorio(
        entrada({
          timestamp: 2000,
          framesDecoded: 4,
          totalInterFrameDelay: 0.12,
          totalSquaredInterFrameDelay: 0.0004 + 0.0016 + 0.0004 + 0.0016,
        }),
      ),
      primeira.base,
    )
    expect(amostra.desvioEntreQuadrosMs).toBeCloseTo(10, 5)
  })

  it('atraso do jitter buffer por quadro emitido, e perda por pacotes no intervalo', () => {
    const primeira = lerAmostraDoEspectador(relatorio(entrada()), null)
    const { amostra } = lerAmostraDoEspectador(
      relatorio(
        entrada({
          timestamp: 2000,
          jitterBufferDelay: 1.5,
          jitterBufferEmittedCount: 30,
          packetsReceived: 190,
          packetsLost: 10,
          jitter: 0.008,
        }),
      ),
      primeira.base,
    )
    expect(amostra.atrasoDoBufferMs).toBe(50)
    expect(amostra.perda).toBe(5)
    expect(amostra.jitterMs).toBe(8)
  })

  it('decoder, codec, resolução e protocolo', () => {
    const { amostra } = lerAmostraDoEspectador(
      relatorio(
        entrada({ codecId: 'c1', decoderImplementation: 'FFmpeg', powerEfficientDecoder: true }),
        { id: 'c1', type: 'codec', mimeType: 'video/AV1' },
        ...REDE_UDP,
      ),
      null,
    )
    expect(amostra.decoder).toBe('FFmpeg')
    expect(amostra.decoderEmHardware).toBe(true)
    expect(amostra.codec).toBe('AV1')
    expect([amostra.largura, amostra.altura]).toEqual([1280, 720])
    expect(amostra.protocolo).toBe('udp')
    expect(amostra.rtt).toBe(42)
  })

  it('a amostra é um objeto fechado', () => {
    const { amostra } = lerAmostraDoEspectador(relatorio(entrada({ ssrc: 9 })), null)
    expect(amostra).not.toHaveProperty('ssrc')
    const chaves: (keyof AmostraDoEspectador)[] = ['emMs', 'fpsDecodificado', 'fpsRecebido', 'freezes', 'perda', 'protocolo']
    for (const chave of chaves) expect(amostra).toHaveProperty(chave)
  })
})
