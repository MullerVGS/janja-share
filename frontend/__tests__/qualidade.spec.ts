import { describe, expect, it, vi } from 'vitest'
import {
  aplicarPerfil,
  parametrosDoPerfil,
  restricoesDoPerfil,
  PERFIL_PADRAO,
  PRESETS,
  PRIORIDADES,
  TETO,
  trocarPrioridade,
  type PerfilDeQualidade,
} from '../src/sala/qualidade'

function perfil(parcial: Partial<PerfilDeQualidade> = {}): PerfilDeQualidade {
  return { ...PERFIL_PADRAO, ...parcial }
}

function faixaFalsa() {
  return {
    contentHint: '',
    applyConstraints: vi.fn(async () => {}),
  }
}

function remetenteFalso(encodings: unknown[] = [{ rid: 'q' }]) {
  const guardados = {
    transactionId: 'tx-1',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
    encodings,
  } as unknown as RTCRtpSendParameters

  const setParameters = vi.fn(async (novos: RTCRtpSendParameters) => {
    Object.assign(guardados, novos)
  })

  return {
    getParameters: () => guardados,
    setParameters,
    atuais: () => guardados,
  }
}

describe('tradução do perfil para a captura', () => {
  it('restringe a altura ao teto escolhido e a taxa de quadros', () => {
    expect(restricoesDoPerfil(perfil({ resolucao: '720p', fps: 30 }))).toEqual({
      frameRate: { max: 30 },
      height: { max: 720 },
    })
  })

  it('resolução nativa não manda restrição de altura nenhuma', () => {
    const restricoes = restricoesDoPerfil(perfil({ resolucao: 'nativa', fps: 5 }))
    expect(restricoes).toEqual({ frameRate: { max: 5 } })
    expect(restricoes).not.toHaveProperty('height')
  })

  it('a altura é teto e não alvo — nunca amplia uma tela menor', () => {
    const { height } = restricoesDoPerfil(perfil({ resolucao: '1440p' }))
    expect(height).toEqual({ max: 1440 })
    expect(height).not.toHaveProperty('ideal')
    expect(height).not.toHaveProperty('min')
  })
})

describe('tradução do perfil para o encoder', () => {
  it('nitidez cede quadros: maintain-resolution', () => {
    const parametros = parametrosDoPerfil(remetenteFalso().getParameters(), perfil({ prioridade: 'nitidez' }))
    expect(parametros.degradationPreference).toBe('maintain-resolution')
  })

  it('fluidez cede resolução: maintain-framerate', () => {
    const parametros = parametrosDoPerfil(remetenteFalso().getParameters(), perfil({ prioridade: 'fluidez' }))
    expect(parametros.degradationPreference).toBe('maintain-framerate')
  })

  it('põe o teto em kbps→bps e o fps em todas as camadas', () => {
    const atuais = remetenteFalso([{ rid: 'q' }, { rid: 'h' }]).getParameters()
    const parametros = parametrosDoPerfil(atuais, perfil({ tetoKbps: 1800, fps: 15 }))

    expect(parametros.encodings).toHaveLength(2)
    for (const encoding of parametros.encodings) {
      expect(encoding.maxBitrate).toBe(1_800_000)
      expect(encoding.maxFramerate).toBe(15)
    }
  })

  it('preserva o transactionId e não mexe no objeto original', () => {
    const atuais = remetenteFalso().getParameters()
    const parametros = parametrosDoPerfil(atuais, perfil({ tetoKbps: 900 }))

    expect(parametros.transactionId).toBe('tx-1')
    expect(atuais.encodings[0]).not.toHaveProperty('maxBitrate')
  })

  it('sender sem encodings continua sem encodings — inventar um faria o setParameters recusar tudo', () => {
    const atuais = remetenteFalso([]).getParameters()
    const parametros = parametrosDoPerfil(atuais, perfil())

    expect(parametros.encodings).toEqual([])
    expect(parametros.degradationPreference).toBe('maintain-resolution')
  })
})

describe('aplicação ao vivo', () => {
  it('nitidez marca o conteúdo como detalhe e ajusta as duas metades', async () => {
    const faixa = faixaFalsa()
    const remetente = remetenteFalso()

    const relatorio = await aplicarPerfil(
      { faixa: faixa as unknown as MediaStreamTrack, remetente: remetente as unknown as RTCRtpSender },
      perfil({ prioridade: 'nitidez', fps: 15, tetoKbps: 2000, resolucao: '1080p' }),
    )

    expect(faixa.contentHint).toBe('detail')
    expect(faixa.applyConstraints).toHaveBeenCalledWith({ frameRate: { max: 15 }, height: { max: 1080 } })
    expect(remetente.setParameters).toHaveBeenCalledOnce()
    expect(remetente.atuais().degradationPreference).toBe('maintain-resolution')
    expect(remetente.atuais().encodings[0]?.maxBitrate).toBe(2_000_000)
    expect(relatorio).toEqual({ captura: 'aplicado', encoder: 'aplicado' })
  })

  it('fluidez marca o conteúdo como movimento', async () => {
    const faixa = faixaFalsa()
    await aplicarPerfil({ faixa: faixa as unknown as MediaStreamTrack }, perfil({ prioridade: 'fluidez' }))

    expect(faixa.contentHint).toBe('motion')
    expect(PRIORIDADES.fluidez.degradacao).toBe('maintain-framerate')
  })

  it('captura recusada não impede o encoder — as metades são independentes', async () => {
    const faixa = faixaFalsa()
    faixa.applyConstraints.mockRejectedValueOnce(new Error('OverconstrainedError: frameRate'))
    const remetente = remetenteFalso()

    const relatorio = await aplicarPerfil(
      { faixa: faixa as unknown as MediaStreamTrack, remetente: remetente as unknown as RTCRtpSender },
      perfil({ fps: 60 }),
    )

    expect(relatorio.captura).toBe('recusado')
    expect(relatorio.encoder).toBe('aplicado')
    expect(relatorio.falhaDaCaptura).toContain('OverconstrainedError')
    expect(remetente.atuais().encodings[0]?.maxFramerate).toBe(60)
  })

  it('o contentHint vale mesmo quando a restrição de captura é recusada', async () => {
    const faixa = faixaFalsa()
    faixa.applyConstraints.mockRejectedValueOnce(new Error('não rola'))

    await aplicarPerfil({ faixa: faixa as unknown as MediaStreamTrack }, perfil({ prioridade: 'nitidez' }))

    expect(faixa.contentHint).toBe('detail')
  })

  it('sem sender ainda ajusta a captura, e diz que o encoder ficou de fora', async () => {
    const faixa = faixaFalsa()
    const relatorio = await aplicarPerfil({ faixa: faixa as unknown as MediaStreamTrack }, perfil())

    expect(relatorio).toEqual({ captura: 'aplicado', encoder: 'indisponivel' })
    expect(faixa.applyConstraints).toHaveBeenCalledOnce()
  })

  it('sem faixa e sem sender não estoura — só relata que não havia o que ajustar', async () => {
    expect(await aplicarPerfil({}, perfil())).toEqual({ captura: 'indisponivel', encoder: 'indisponivel' })
  })
})

/**
 * Os presets são dimensionados pelo upload residencial de quem compartilha, não pela VPS (que
 * sobe ~1 Gbps medido). Estes testes existem para que apertá-los "para poupar o servidor" tenha
 * de ser uma decisão explícita, e não um deslize.
 */
describe('presets dimensionados pelo uplink de quem compartilha', () => {
  it('nitidez fica em 1080p a 15 fps com 2500 kbps', () => {
    expect(PRESETS.nitidez).toEqual({ resolucao: '1080p', fps: 15, prioridade: 'nitidez', tetoKbps: 2500 })
  })

  it('fluidez dobra os quadros e sobe o teto junto — 1080p a 30 fps com 4000 kbps', () => {
    expect(PRESETS.fluidez).toEqual({ resolucao: '1080p', fps: 30, prioridade: 'fluidez', tetoKbps: 4000 })
  })

  it('o perfil de partida é o preset de nitidez', () => {
    expect(PERFIL_PADRAO).toBe(PRESETS.nitidez)
  })

  it('o slider chega a 10 Mbps — teto de quem tem fibra boa e quer 1440p60', () => {
    expect(TETO.maximoKbps).toBe(10_000)
    expect(TETO.minimoKbps).toBeLessThan(PRESETS.nitidez.tetoKbps)
  })
})

describe('troca de prioridade', () => {
  it('aplica os quadros e o teto do preset escolhido', () => {
    const depois = trocarPrioridade(PRESETS.nitidez, 'fluidez')
    expect(depois.prioridade).toBe('fluidez')
    expect(depois.fps).toBe(30)
    expect(depois.tetoKbps).toBe(4000)
  })

  it('preserva a resolução escolhida — quem desceu para 720p por causa da rede não volta a 1080p', () => {
    const magro = perfil({ resolucao: '720p', prioridade: 'nitidez' })
    expect(trocarPrioridade(magro, 'fluidez').resolucao).toBe('720p')
  })

  it('a volta para nitidez devolve 15 fps e 2500 kbps', () => {
    const depois = trocarPrioridade(trocarPrioridade(PERFIL_PADRAO, 'fluidez'), 'nitidez')
    expect([depois.fps, depois.tetoKbps]).toEqual([15, 2500])
  })
})
