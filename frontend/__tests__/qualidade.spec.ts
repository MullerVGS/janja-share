import { describe, expect, it, vi } from 'vitest'
import {
  aplicarPerfil,
  CEDER,
  CONTEUDOS,
  ehPerfil,
  parametrosDoPerfil,
  PERFIL_PADRAO,
  PRESET_DO_CONTEUDO,
  resolucaoDaAltura,
  restricoesDoPerfil,
  TETO,
  trocarConteudo,
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

  it('540p existe como degrau de captura: é até onde o governador desce', () => {
    expect(restricoesDoPerfil(perfil({ resolucao: '540p' })).height).toEqual({ max: 540 })
    expect(resolucaoDaAltura(540)).toBe('540p')
    expect(resolucaoDaAltura(1080)).toBe('1080p')
    expect(resolucaoDaAltura(999)).toBeNull()
  })
})

describe('tradução do perfil para o encoder', () => {
  it('ceder quadros: maintain-resolution', () => {
    const parametros = parametrosDoPerfil(remetenteFalso().getParameters(), perfil({ ceder: 'quadros' }))
    expect(parametros.degradationPreference).toBe('maintain-resolution')
  })

  it('ceder resolução: maintain-framerate', () => {
    const parametros = parametrosDoPerfil(remetenteFalso().getParameters(), perfil({ ceder: 'resolucao' }))
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
  it('texto marca o conteúdo como text e ajusta as duas metades', async () => {
    const faixa = faixaFalsa()
    const remetente = remetenteFalso()

    const relatorio = await aplicarPerfil(
      { faixa: faixa as unknown as MediaStreamTrack, remetente: remetente as unknown as RTCRtpSender },
      perfil({ conteudo: 'texto', ceder: 'quadros', fps: 15, tetoKbps: 2000, resolucao: '1080p' }),
    )

    expect(faixa.contentHint).toBe('text')
    expect(faixa.applyConstraints).toHaveBeenCalledWith({ frameRate: { max: 15 }, height: { max: 1080 } })
    expect(remetente.setParameters).toHaveBeenCalledOnce()
    expect(remetente.atuais().degradationPreference).toBe('maintain-resolution')
    expect(remetente.atuais().encodings[0]?.maxBitrate).toBe(2_000_000)
    expect(relatorio).toEqual({ captura: 'aplicado', encoder: 'aplicado' })
  })

  it('movimento marca o conteúdo como motion', async () => {
    const faixa = faixaFalsa()
    await aplicarPerfil({ faixa: faixa as unknown as MediaStreamTrack }, perfil({ conteudo: 'movimento' }))

    expect(faixa.contentHint).toBe('motion')
    expect(CONTEUDOS.movimento.contentHint).toBe('motion')
    expect(CEDER.resolucao.degradacao).toBe('maintain-framerate')
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

    await aplicarPerfil({ faixa: faixa as unknown as MediaStreamTrack }, perfil({ conteudo: 'texto' }))

    expect(faixa.contentHint).toBe('text')
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
describe('presets por conteúdo', () => {
  it('Texto: 1080p a 15 fps, 2500 kbps, VP9, cede quadros', () => {
    expect(PRESET_DO_CONTEUDO.texto).toEqual({
      conteudo: 'texto',
      codec: 'vp9',
      resolucao: '1080p',
      fps: 15,
      ceder: 'quadros',
      tetoKbps: 2500,
    })
  })

  it('Movimento: 1080p a 60 fps, 8000 kbps, H.264, cede resolução', () => {
    expect(PRESET_DO_CONTEUDO.movimento).toEqual({
      conteudo: 'movimento',
      codec: 'h264',
      resolucao: '1080p',
      fps: 60,
      ceder: 'resolucao',
      tetoKbps: 8000,
    })
  })

  it('o perfil de partida é o preset de texto', () => {
    expect(PERFIL_PADRAO).toBe(PRESET_DO_CONTEUDO.texto)
  })

  it('o slider vai de 200 kb/s a 20 Mb/s', () => {
    expect(TETO).toEqual({ minimoKbps: 200, maximoKbps: 20_000, passoKbps: 100 })
  })
})

describe('troca de conteúdo', () => {
  it('aplica codec, quadros, teto e o eixo a ceder do preset escolhido', () => {
    const depois = trocarConteudo(PRESET_DO_CONTEUDO.texto, 'movimento')
    expect(depois).toMatchObject({ conteudo: 'movimento', codec: 'h264', fps: 60, tetoKbps: 8000, ceder: 'resolucao' })
  })

  it('preserva a resolução escolhida — quem desceu para 720p por causa da rede não volta a 1080p', () => {
    const magro = perfil({ resolucao: '720p', conteudo: 'texto' })
    expect(trocarConteudo(magro, 'movimento').resolucao).toBe('720p')
  })

  it('a volta para texto devolve VP9, 15 fps e 2500 kbps', () => {
    const depois = trocarConteudo(trocarConteudo(PERFIL_PADRAO, 'movimento'), 'texto')
    expect([depois.codec, depois.fps, depois.tetoKbps]).toEqual(['vp9', 15, 2500])
  })
})

describe('perfil vindo de fora (preferências)', () => {
  it('aceita um perfil inteiro e válido', () => {
    expect(ehPerfil({ ...PRESET_DO_CONTEUDO.movimento, resolucao: '540p', tetoKbps: 12_300 })).toBe(true)
  })

  it('recusa campo faltando, valor fora do vocabulário, fps estranho e teto fora do slider', () => {
    const { codec: _codec, ...semCodec } = PERFIL_PADRAO
    expect(ehPerfil(semCodec)).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, conteudo: 'nitidez' })).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, codec: 'h265' })).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, ceder: 'tudo' })).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, resolucao: '4k' })).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, fps: 45 })).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, tetoKbps: 50_000 })).toBe(false)
    expect(ehPerfil({ ...PERFIL_PADRAO, tetoKbps: 100 })).toBe(false)
    expect(ehPerfil(null)).toBe(false)
    expect(ehPerfil('texto')).toBe(false)
  })
})
