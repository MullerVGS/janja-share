import { act, renderHook } from '@testing-library/react'
import { Track, type Room, type TrackPublishOptions } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gravarPreferencias, lerPreferencias } from '../src/preferencias'
import { OPCOES_DO_AUDIO_DA_TELA } from '../src/sala/audioDaTela'
import { PRESET_DO_CONTEUDO } from '../src/sala/qualidade'
import { useCompartilhamento } from '../src/sala/useCompartilhamento'
import { amostraVaziaDoEmissor, amostraVaziaDoEspectador, type AmostraDoEmissor } from '../src/telemetria/amostra'
import { anotar, type Historico } from '../src/telemetria/historico'
import type { Espectador } from '../src/telemetria/relato'

/**
 * A captura é módulo, não método do participante: o seletor nativo não existe no jsdom, e é a
 * `SalaFalsa` de cada teste que decide o que ele "devolve" — por isso o mock só delega.
 */
const seletor = vi.hoisted(() => ({ abrir: vi.fn(), embrulhar: vi.fn() }))
vi.mock('../src/sala/captura', () => ({
  capturarTela: (perfil: unknown) => seletor.abrir(perfil),
  // A troca de tela usa a captura crua: as mesmas faixas do seletor falso, sem o embrulho.
  abrirSeletor: async (perfil: unknown) => {
    const faixas = (await seletor.abrir(perfil)) as { kind: string; mediaStreamTrack: unknown }[]
    return {
      video: faixas.find((faixa) => faixa.kind === 'video')?.mediaStreamTrack,
      audio: faixas.find((faixa) => faixa.kind === 'audio')?.mediaStreamTrack ?? null,
    }
  },
  embrulharSomDaTela: (som: unknown) => seletor.embrulhar(som),
}))

/** A `MediaStreamTrack` reduzida ao que o hook toca: estado, dica, restrições e parar. */
function faixaDoNavegador() {
  const faixa = {
    readyState: 'live' as MediaStreamTrackState,
    contentHint: '',
    applyConstraints: vi.fn(async () => {}),
    stop: vi.fn(() => {
      faixa.readyState = 'ended'
    }),
  }
  return faixa
}

/** Uma `LocalTrack` reduzida ao que o hook toca: a faixa do navegador, o sender e o codec publicado. */
function faixaFalsa(kind: 'video' | 'audio', codec: string | undefined = 'vp9') {
  const parametros = { transactionId: 'tx', encodings: [{ active: true }] } as unknown as RTCRtpSendParameters
  return {
    kind,
    codec: codec as string | undefined,
    isMuted: false,
    mediaStreamTrack: faixaDoNavegador(),
    sender: {
      getParameters: () => parametros,
      setParameters: vi.fn(async (novos: RTCRtpSendParameters) => {
        Object.assign(parametros, novos)
      }),
    } as unknown as RTCRtpSender | undefined,
    parametros: () => parametros,
    stop: vi.fn(),
    /** Como no SDK: a faixa nova entra no mesmo sender, e a antiga — que é do SDK — para. */
    replaceTrack: vi.fn(async (_nova: ReturnType<typeof faixaDoNavegador>, _doUsuario?: boolean) => {}),
  }
}

type Faixa = ReturnType<typeof faixaFalsa>
type Publicacao = {
  trackSid: string
  track: Faixa
  options?: TrackPublishOptions
  readonly isMuted: boolean
  mute(): Promise<void>
  unmute(): Promise<void>
}

/**
 * O participante local de mentira: guarda publicações por fonte e se comporta como o SDK nos
 * pontos que importam — `unpublishTrack(track, false)` mantém a faixa viva, `publishTrack`
 * recusa faixa morta e define `track.codec` pelas opções.
 *
 * Cada chamada ao SDK só anda quando o teste chama `bater()`: é o que separa, em renders
 * distintos, o `setState` de antes da chamada e o de depois — como na sala de verdade, onde o
 * SDK responde noutro tick. Num `act` assíncrono com resposta imediata, os dois se anulariam
 * num render só, e o React descartaria os efeitos desse render junto com as mudanças lidas do
 * `Room`.
 */
class SalaFalsa {
  publicacoes = new Map<Track.Source, Publicacao>()
  sids = 0
  comAudio = true
  /** O que o último abrir-seletor entregou — para conferir quem foi parado. */
  ultimaCaptura: Faixa[] = []
  private pendentes: (() => void)[] = []

  constructor() {
    // O seletor nativo aberto: entrega faixas de captura sem publicar nada.
    seletor.abrir.mockReset()
    seletor.abrir.mockImplementation(async (_perfil?: unknown) => {
      await this.proximaBatida()
      const faixas = [faixaFalsa('video', undefined)]
      if (this.comAudio) faixas.push(faixaFalsa('audio', undefined))
      this.ultimaCaptura = faixas
      return faixas
    })
    seletor.embrulhar.mockReset()
    seletor.embrulhar.mockImplementation((som: unknown) => this.ultimaCaptura.find((faixa) => faixa.mediaStreamTrack === som))
  }

  /** Os outros da Sala, pela tela que publicam ou não — é o que o teto da Sala conta. */
  remoteParticipants = new Map<string, { getTrackPublication: (fonte: Track.Source) => unknown }>()

  localParticipant = {
    getTrackPublication: (fonte: Track.Source) => this.publicacoes.get(fonte),

    // Só o desligar (`ligar()` captura e publica faixa a faixa via `capturarTela` +
    // `publishTrack` — é o próprio bug desta suíte: `setScreenShareEnabled(true, ...)` aplicaria
    // a mesma opção, moldada para vídeo, a toda faixa que o SDK capturasse).
    setScreenShareEnabled: vi.fn(async (ligar: boolean) => {
      await this.proximaBatida()
      if (!ligar) {
        this.publicacoes.delete(Track.Source.ScreenShare)
        this.publicacoes.delete(Track.Source.ScreenShareAudio)
      }
      return undefined
    }),

    unpublishTrack: vi.fn(async (faixa: Faixa, parar?: boolean) => {
      await this.proximaBatida()
      const entrada = [...this.publicacoes].find(([, publicacao]) => publicacao.track === faixa)
      if (!entrada) return undefined
      this.publicacoes.delete(entrada[0])
      faixa.sender = undefined
      if (parar !== false) faixa.mediaStreamTrack.readyState = 'ended'
      return entrada[1]
    }),

    publishTrack: vi.fn(async (faixa: Faixa, opcoes: TrackPublishOptions) => {
      await this.proximaBatida()
      if (faixa.mediaStreamTrack.readyState === 'ended') throw new Error('track is ended')
      if (faixa.kind === 'video') faixa.codec = opcoes.videoCodec
      return this.publicar(opcoes.source ?? Track.Source.ScreenShare, faixa, opcoes)
    }),
  }

  private proximaBatida() {
    return new Promise<void>((resolve) => this.pendentes.push(resolve))
  }

  /** Libera as chamadas ao SDK que estão esperando; devolve se havia alguma. */
  bater(): boolean {
    const presas = this.pendentes.splice(0)
    for (const soltar of presas) soltar()
    return presas.length > 0
  }

  /** Como no SDK, o mudo mora na faixa: a publicação só o repassa, e por isso ele atravessa uma republicação. */
  private publicar(fonte: Track.Source, faixa: Faixa, options?: TrackPublishOptions): Publicacao {
    this.sids += 1
    faixa.sender = faixa.sender ?? faixaFalsa(faixa.kind).sender
    faixa.replaceTrack.mockImplementation(async (nova) => {
      await this.proximaBatida()
      if (!faixa.sender) throw new Error('unable to replace an unpublished track')
      faixa.mediaStreamTrack.readyState = 'ended'
      faixa.mediaStreamTrack = nova
    })
    const publicacao: Publicacao = {
      trackSid: `t${this.sids}`,
      track: faixa,
      options,
      get isMuted() {
        return faixa.isMuted
      },
      mute: vi.fn(async () => {
        faixa.isMuted = true
      }),
      unmute: vi.fn(async () => {
        faixa.isMuted = false
      }),
    }
    this.publicacoes.set(fonte, publicacao)
    return publicacao
  }

  video() {
    return this.publicacoes.get(Track.Source.ScreenShare)
  }

  audio() {
    return this.publicacoes.get(Track.Source.ScreenShareAudio)
  }
}

const CPU: Partial<AmostraDoEmissor> = { ativo: true, limitadoPor: 'cpu', fpsCodificado: 40, altura: 1080, alturaDaCaptura: 1080 }
/** Link folgado e nada limitando: o cenário em que o governador tem de subir. */
const FOLGADO: Partial<AmostraDoEmissor> = { ativo: true, fpsCodificado: 15, altura: 1080, alturaDaCaptura: 1080, bandaDisponivelKbps: 20_000 }

/** Quem assiste, como o coletor entrega ao hook: o último relato de cada pessoa. */
function espectadores(relato: Partial<ReturnType<typeof amostraVaziaDoEspectador>>): ReadonlyMap<string, Espectador> {
  const bia: Espectador = {
    identidade: 'bia-1',
    nome: 'Bia',
    relato: { ...amostraVaziaDoEspectador(Date.now()), ...relato },
    vistoEm: Date.now(),
  }
  return new Map([[bia.identidade, bia]])
}

function montar(sala: SalaFalsa, quemAssiste?: ReadonlyMap<string, Espectador>) {
  let historico: Historico<AmostraDoEmissor> = []
  let emMs = 0
  const resultado = renderHook(({ historico }) => useCompartilhamento(sala as unknown as Room, historico, quemAssiste), {
    initialProps: { historico },
  })

  /** Como o coletor faz: uma amostra por segundo, o histórico crescendo, a árvore re-renderizando. */
  const amostras = (quantas: number, parcial: Partial<AmostraDoEmissor>) => {
    for (let i = 0; i < quantas; i += 1) {
      emMs += 1000
      historico = anotar(historico, { ...amostraVaziaDoEmissor(emMs), ...parcial })
      resultado.rerender({ historico })
    }
  }

  const reler = () => resultado.rerender({ historico })

  /** Uma batida do SDK: solta as chamadas presas e deixa assentar o que vem depois — inclusive o ajuste ao vivo, que espera 180 ms. */
  const batida = async () => {
    await act(async () => {
      sala.bater()
      await vi.advanceTimersByTimeAsync(200)
    })
    reler()
  }

  /** Bate até nenhuma chamada ao SDK ficar presa. */
  const ateAssentar = async () => {
    for (let voltas = 0; voltas < 10; voltas += 1) {
      await batida()
      if (!sala.bater()) return
      await batida()
    }
  }

  /** Começa uma ação e deixa o SDK responder: os dois renders que a sala de verdade faria. */
  const agir = async (acao: () => Promise<void> | void) => {
    let promessa: Promise<void> | void
    act(() => {
      promessa = acao()
    })
    await ateAssentar()
    await act(async () => {
      await promessa
    })
    reler()
  }

  const ligar = () => agir(() => resultado.result.current.alternar())

  return { ...resultado, amostras, ligar, reler, batida, ateAssentar, agir }
}

async function assentar() {
  await act(() => vi.advanceTimersByTimeAsync(200))
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('useCompartilhamento: pedido e preferências', () => {
  it('nasce com o perfil e o automático guardados; mexer persiste os dois', async () => {
    gravarPreferencias({ perfil: { ...PRESET_DO_CONTEUDO.jogo, resolucao: '720p' }, automatico: false })
    const { result } = montar(new SalaFalsa())

    expect(result.current.perfil).toEqual({ ...PRESET_DO_CONTEUDO.jogo, resolucao: '720p' })
    expect(result.current.automatico).toBe(false)

    act(() => result.current.definirPerfil({ ...result.current.perfil, fps: 30 }))
    act(() => result.current.definirAutomatico(true))
    expect(lerPreferencias()).toMatchObject({ perfil: { ...PRESET_DO_CONTEUDO.jogo, resolucao: '720p', fps: 30 }, automatico: true })
  })

  it('ligar publica com as opções do perfil; desligar despublica', async () => {
    const sala = new SalaFalsa()
    const { result, ligar } = montar(sala)
    expect(result.current.ativo).toBe(false)

    await ligar()
    expect(result.current.ativo).toBe(true)
    // O seletor recebe o perfil inteiro — traduzi-lo para o navegador é trabalho de `captura.ts`.
    const [perfilPedido] = seletor.abrir.mock.calls[0] ?? []
    expect(perfilPedido).toMatchObject({ conteudo: 'jogo', codec: 'vp9' })
    const [, opcoes] = sala.localParticipant.publishTrack.mock.calls[0] ?? []
    expect(opcoes).toMatchObject({ videoCodec: 'vp9', scalabilityMode: 'L3T3_KEY' })

    await ligar()
    expect(result.current.ativo).toBe(false)
  })

  it('se parar de compartilhar falhar, o erro chega à pessoa em vez de virar rejeição solta', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    sala.localParticipant.setScreenShareEnabled.mockRejectedValueOnce(new Error('engine fechada'))

    await agir(() => result.current.alternar())

    expect(result.current.erro).toBe('engine fechada')
    expect(result.current.ocupado).toBe(false)
  })
})

describe('useCompartilhamento: governador', () => {
  it('com o automático ligado, limitação persistente desce o degrau e o perfil efetivo vai para o encoder', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras } = montar(sala)
    act(() => result.current.definirPerfil({ ...PRESET_DO_CONTEUDO.texto, fps: 60 }))
    await ligar()
    await assentar()
    expect(sala.video()?.track.parametros().encodings[0]?.maxFramerate).toBe(60)

    amostras(5, CPU)
    await assentar()

    expect(result.current.governador.degrau).toBe(30)
    expect(result.current.perfilEfetivo.fps).toBe(30)
    expect(result.current.perfil.fps).toBe(60)
    expect(sala.video()?.track.parametros().encodings[0]?.maxFramerate).toBe(30)
    expect(sala.video()?.track.mediaStreamTrack.applyConstraints).toHaveBeenLastCalledWith({ frameRate: { max: 30 }, height: { max: 1080 } })
  })

  it('mexer em qualquer controle zera o governador; desligar o automático também', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras } = montar(sala)
    act(() => result.current.definirPerfil({ ...PRESET_DO_CONTEUDO.texto, fps: 60 }))
    await ligar()
    amostras(5, CPU)
    expect(result.current.governador.degrau).toBe(30)

    act(() => result.current.definirPerfil({ ...result.current.perfil, tetoKbps: 3000 }))
    expect(result.current.governador.degrau).toBeNull()
    expect(result.current.perfilEfetivo.fps).toBe(60)

    amostras(5, CPU)
    expect(result.current.governador.degrau).toBe(30)
    act(() => result.current.definirAutomatico(false))
    expect(result.current.governador.degrau).toBeNull()

    amostras(10, CPU)
    expect(result.current.governador.degrau).toBeNull()
  })

  it('com o link folgado, o teto sobe sozinho e o valor novo chega ao encoder', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras } = montar(sala)
    await ligar()
    await assentar()
    expect(sala.video()?.track.parametros().encodings[0]?.maxBitrate).toBe(8_000_000)

    amostras(35, FOLGADO)
    await assentar()

    expect(result.current.governador.tetoKbps).toBe(10_000)
    expect(result.current.perfil.tetoKbps).toBe(8_000)
    expect(result.current.perfilEfetivo.tetoKbps).toBe(10_000)
    expect(sala.video()?.track.parametros().encodings[0]?.maxBitrate).toBe(10_000_000)
  })

  it('um espectador sofrendo segura a subida — o mesmo link folgado não rende nada', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras } = montar(sala, espectadores({ perda: 8 }))
    await ligar()
    amostras(35, FOLGADO)
    await assentar()

    expect(result.current.governador.tetoKbps).toBeNull()
    expect(sala.video()?.track.parametros().encodings[0]?.maxBitrate).toBe(8_000_000)
  })

  it('parar de compartilhar zera o governador', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras } = montar(sala)
    act(() => result.current.definirPerfil({ ...PRESET_DO_CONTEUDO.texto, fps: 60 }))
    await ligar()
    amostras(5, CPU)
    expect(result.current.governador.degrau).toBe(30)

    await ligar()
    expect(result.current.governador.degrau).toBeNull()
  })
})

describe('useCompartilhamento: trocar codec no ar', () => {
  it('republica a mesma faixa de captura com as opções novas — e o áudio da tela vai junto', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const faixaDeVideo = sala.video()?.track
    const faixaDeAudio = sala.audio()?.track
    const sidAntigo = sala.video()?.trackSid
    // `ligar()` já publicou as duas faixas na captura inicial; as contagens abaixo são só da republicação.
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.definirCodecPreferido('av1'))

    const { unpublishTrack, publishTrack } = sala.localParticipant
    expect(unpublishTrack.mock.calls).toEqual([
      [faixaDeVideo, false],
      [faixaDeAudio, false],
    ])
    expect(publishTrack).toHaveBeenCalledTimes(2)
    expect(publishTrack.mock.calls[0]?.[0]).toBe(faixaDeVideo)
    expect(publishTrack.mock.calls[0]?.[1]).toMatchObject({ videoCodec: 'av1', backupCodec: false, scalabilityMode: 'L3T3_KEY' })
    expect(publishTrack.mock.calls[1]).toEqual([faixaDeAudio, OPCOES_DO_AUDIO_DA_TELA])

    expect(sala.video()?.track).toBe(faixaDeVideo)
    expect(sala.video()?.trackSid).not.toBe(sidAntigo)
    expect(sala.video()?.track.codec).toBe('av1')
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
    expect(result.current.codecPendente).toBeNull()
    expect(faixaDeVideo?.mediaStreamTrack.readyState).toBe('live')
  })

  it('trocar o conteúdo não mexe no codec nem republica: conteúdo não escolhe encoder', async () => {
    const sala = new SalaFalsa()
    sala.comAudio = false
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const codecAntes = sala.video()?.track.codec
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.definirPerfil({ ...PRESET_DO_CONTEUDO.jogo }))

    // O pedido muda no que é de conteúdo — fps e o eixo a ceder —, e a faixa fica onde está.
    expect(result.current.perfil.fps).toBe(60)
    expect(result.current.perfil.ceder).toBe('resolucao')
    expect(sala.localParticipant.unpublishTrack).not.toHaveBeenCalled()
    expect(sala.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(sala.video()?.track.codec).toBe(codecAntes)
  })

  it('o mesmo codec não republica nada', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, fps: 30 }))

    expect(sala.localParticipant.unpublishTrack).not.toHaveBeenCalled()
  })

  it('no meio da republicação a transmissão segue ativa e ocupada — não é "parou", que zeraria o governador', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, batida } = montar(sala)
    await ligar()

    act(() => result.current.definirCodecPreferido('av1'))
    await batida()
    await batida()
    expect(sala.video()).toBeUndefined()
    expect(sala.audio()).toBeUndefined()
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(true)

    await batida()
    await batida()
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
    expect(sala.video()?.track.codec).toBe('av1')
  })

  it('se o SDK recusar a publicação nova, volta a anterior ao ar e o codec fica pendente para o próximo compartilhamento', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const faixaDeVideo = sala.video()?.track
    const opcoesAntigas = sala.video()?.options
    sala.localParticipant.publishTrack.mockRejectedValueOnce(new Error('codec not supported'))

    await agir(() => result.current.definirCodecPreferido('av1'))

    expect(result.current.codecPendente).toBe('av1')
    expect(result.current.perfil.codec).toBe('av1')
    expect(result.current.ativo).toBe(true)
    expect(sala.video()?.track).toBe(faixaDeVideo)
    expect(sala.video()?.track.codec).toBe('vp9')
    expect(sala.audio()).toBeDefined()
    // A volta usa as opções que o SDK guardou na publicação anterior.
    const ultimaPublicacaoDeVideo = sala.localParticipant.publishTrack.mock.calls.filter(([faixa]) => faixa === faixaDeVideo).at(-1)
    expect(ultimaPublicacaoDeVideo?.[1]).toBe(opcoesAntigas)
  })

  it('se a faixa chegar morta ao despublicar, não há o que republicar: fica pendente e a transmissão cai', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const faixaDeAudio = sala.audio()?.track
    // `ligar()` já publicou as duas faixas na captura inicial; a asserção abaixo é sobre a republicação.
    sala.localParticipant.publishTrack.mockClear()
    sala.localParticipant.unpublishTrack.mockImplementationOnce(async (faixa: Faixa) => {
      sala.publicacoes.delete(Track.Source.ScreenShare)
      faixa.mediaStreamTrack.readyState = 'ended'
      return undefined
    })

    await agir(() => result.current.definirCodecPreferido('av1'))

    expect(sala.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(result.current.codecPendente).toBe('av1')
    expect(result.current.ativo).toBe(false)
    expect(sala.audio()).toBeUndefined()
    // O áudio foi despublicado sem parar; órfão, precisa morrer junto.
    expect(faixaDeAudio?.stop).toHaveBeenCalledOnce()
  })

  it('se só o áudio da tela não voltar, o vídeo está no ar com o codec novo: nada de pendente — é erro próprio, e o áudio órfão para', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const faixaDeAudio = sala.audio()?.track
    const publicar = sala.localParticipant.publishTrack.getMockImplementation()
    sala.localParticipant.publishTrack.mockImplementation(async (faixa: Faixa, opcoes: TrackPublishOptions) => {
      if (faixa.kind === 'audio') throw new Error('sem vaga para áudio')
      return publicar?.(faixa, opcoes) as Promise<Publicacao>
    })

    await agir(() => result.current.definirCodecPreferido('av1'))

    expect(sala.video()?.track.codec).toBe('av1')
    expect(result.current.codecPendente).toBeNull()
    expect(result.current.erro).toMatch(/áudio da tela/)
    expect(sala.audio()).toBeUndefined()
    expect(faixaDeAudio?.stop).toHaveBeenCalledOnce()
  })

  it('Reiniciar transmissão para e começa de novo com o perfil pedido, e limpa o pendente', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    sala.localParticipant.publishTrack.mockRejectedValueOnce(new Error('nope'))
    await agir(() => result.current.definirCodecPreferido('av1'))
    expect(result.current.codecPendente).toBe('av1')
    sala.localParticipant.setScreenShareEnabled.mockClear()
    seletor.abrir.mockClear()
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.reiniciar())

    // Reiniciar para (desligarAntes) e captura+publica de novo — não delega mais ao
    // `setScreenShareEnabled(true, ...)`, que aplicaria a mesma opção de vídeo ao áudio.
    expect(sala.localParticipant.setScreenShareEnabled).toHaveBeenCalledExactlyOnceWith(false)
    expect(seletor.abrir).toHaveBeenCalledOnce()
    expect(sala.localParticipant.publishTrack.mock.calls[0]?.[1]).toMatchObject({ videoCodec: 'av1' })
    expect(result.current.codecPendente).toBeNull()
    expect(result.current.ativo).toBe(true)
    expect(sala.video()?.track.codec).toBe('av1')
  })

  it('um segundo pedido de codec durante a republicação é atendido depois dela', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, batida, ateAssentar, reler } = montar(sala)
    await ligar()

    act(() => result.current.definirCodecPreferido('av1'))
    await batida()
    act(() => result.current.definirCodecPreferido('h264'))
    await ateAssentar()
    reler()

    expect(sala.video()?.track.codec).toBe('h264')
    expect(result.current.perfil.codec).toBe('h264')
    expect(result.current.ocupado).toBe(false)
  })
})

describe('useCompartilhamento: áudio da tela', () => {
  it('sem áudio no seletor não há publicação para calar', async () => {
    const sala = new SalaFalsa()
    sala.comAudio = false
    const { result, ligar } = montar(sala)
    await ligar()

    expect(result.current.audioDaTela).toBeNull()
  })

  /**
   * Este é o caminho comum: começar a compartilhar pela primeira vez, não trocar de tela nem de
   * codec. `setScreenShareEnabled` do SDK real publica toda faixa da captura com o
   * mesmo `publishOptions` — moldado para vídeo — então sem publicar o áudio à parte ele nasce
   * nos 48 kbps mono com DTX do vídeo, não nos 128 kbps estéreo de `OPCOES_DO_AUDIO_DA_TELA`.
   */
  it('ligar publica o áudio da tela com as opções de mídia, não as de vídeo', async () => {
    const sala = new SalaFalsa()
    const { result, ligar } = montar(sala)
    await ligar()

    expect(result.current.audioDaTela).toBe(sala.audio())
    expect(sala.audio()?.options).toEqual(OPCOES_DO_AUDIO_DA_TELA)
  })

  it('calar e devolver o som é mute na publicação — a faixa não sai do ar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir, reler } = montar(sala)
    await ligar()
    const faixaDeAudio = sala.audio()?.track
    expect(result.current.audioDaTela).toBe(sala.audio())

    await agir(() => result.current.alternarAudioDaTela())
    expect(sala.audio()?.isMuted).toBe(true)
    expect(sala.audio()?.track).toBe(faixaDeAudio)
    expect(sala.localParticipant.unpublishTrack).not.toHaveBeenCalled()

    await agir(() => result.current.alternarAudioDaTela())
    reler()
    expect(sala.audio()?.isMuted).toBe(false)
  })

  it('o áudio calado volta calado da troca de codec — republicar não é desculpa para voltar a falar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    await agir(() => result.current.alternarAudioDaTela())

    await agir(() => result.current.definirCodecPreferido('av1'))

    expect(sala.video()?.track.codec).toBe('av1')
    expect(sala.audio()).toBeDefined()
    expect(sala.audio()?.isMuted).toBe(true)
  })
})

describe('useCompartilhamento: trocar de tela', () => {
  it('a fonte nova entra na mesma publicação: mesmo trackSid, mesmo codec, nada sai do ar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const video = sala.video()
    const audio = sala.audio()
    const capturaAntiga = video?.track.mediaStreamTrack
    const somAntigo = audio?.track.mediaStreamTrack
    seletor.abrir.mockClear()
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.trocarDeTela())

    expect(seletor.abrir).toHaveBeenCalledOnce()
    // Quem assiste não vê nada sair: nem a imagem nem o som foram despublicados.
    expect(sala.localParticipant.unpublishTrack).not.toHaveBeenCalled()
    expect(sala.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(sala.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled()
    expect(sala.video()).toBe(video)
    expect(sala.video()?.trackSid).toBe(video?.trackSid)
    expect(sala.video()?.track.codec).toBe('vp9')
    // A captura nova está no sender; a antiga parou.
    const [novaImagem, novoSom] = sala.ultimaCaptura
    expect(sala.video()?.track.mediaStreamTrack).toBe(novaImagem?.mediaStreamTrack)
    expect(sala.video()?.track.replaceTrack).toHaveBeenCalledWith(novaImagem?.mediaStreamTrack, false)
    expect(capturaAntiga?.readyState).toBe('ended')
    expect(sala.audio()).toBe(audio)
    expect(sala.audio()?.track.mediaStreamTrack).toBe(novoSom?.mediaStreamTrack)
    expect(somAntigo?.readyState).toBe('ended')
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
    expect(result.current.erro).toBeNull()
  })

  it('o ajuste ao vivo roda de novo na captura nova — o SDK reaplica os encodings ao trocar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    await assentar()

    await agir(() => result.current.trocarDeTela())
    await assentar()

    expect(sala.video()?.track.mediaStreamTrack.applyConstraints).toHaveBeenCalledWith({
      frameRate: { max: 60 },
      height: { max: 1080 },
    })
  })

  it('a fonte nova sem som tira o som da tela do ar — e só ele', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const video = sala.video()
    const somAntigo = sala.audio()?.track
    sala.comAudio = false

    await agir(() => result.current.trocarDeTela())

    expect(sala.localParticipant.unpublishTrack.mock.calls).toEqual([[somAntigo, true]])
    expect(sala.audio()).toBeUndefined()
    expect(sala.video()).toBe(video)
    expect(result.current.audioDaTela).toBeNull()
  })

  it('a fonte nova com som, depois de uma sem, publica o som com as opções de mídia', async () => {
    const sala = new SalaFalsa()
    sala.comAudio = false
    const { result, ligar, agir } = montar(sala)
    await ligar()
    expect(sala.audio()).toBeUndefined()
    sala.comAudio = true
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.trocarDeTela())

    const [, somNovo] = sala.ultimaCaptura
    expect(sala.localParticipant.publishTrack.mock.calls).toEqual([[somNovo, OPCOES_DO_AUDIO_DA_TELA]])
    expect(sala.audio()?.track).toBe(somNovo)
  })

  it('o som calado continua calado na fonte nova', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    await agir(() => result.current.alternarAudioDaTela())

    await agir(() => result.current.trocarDeTela())

    expect(sala.audio()?.isMuted).toBe(true)
  })

  it('se a troca falhar, a captura recém-aberta morre e a de antes continua no ar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const capturaAntiga = sala.video()?.track.mediaStreamTrack
    sala.video()?.track.replaceTrack.mockRejectedValueOnce(new Error('sender fechado'))

    await agir(() => result.current.trocarDeTela())

    for (const faixa of sala.ultimaCaptura) expect(faixa.mediaStreamTrack.stop).toHaveBeenCalledOnce()
    expect(sala.video()?.track.mediaStreamTrack).toBe(capturaAntiga)
    expect(capturaAntiga?.readyState).toBe('live')
    expect(result.current.erro).toBe('sender fechado')
    expect(result.current.ocupado).toBe(false)
  })

  it('cancelar o seletor não mexe em nada — a tela que estava no ar continua no ar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const antiga = sala.video()?.track.mediaStreamTrack
    const cancelou = Object.assign(new Error('cancelou'), { name: 'NotAllowedError' })
    seletor.abrir.mockRejectedValueOnce(cancelou)

    await agir(() => result.current.trocarDeTela())

    expect(sala.video()?.track.mediaStreamTrack).toBe(antiga)
    expect(sala.video()?.track.replaceTrack).not.toHaveBeenCalled()
    expect(sala.localParticipant.unpublishTrack).not.toHaveBeenCalled()
    expect(result.current.ativo).toBe(true)
    expect(result.current.erro).toBeNull()
  })

  it('sem tela no ar não há o que trocar', async () => {
    const sala = new SalaFalsa()
    const { result, agir } = montar(sala)

    await agir(() => result.current.trocarDeTela())

    expect(seletor.abrir).not.toHaveBeenCalled()
  })

  /**
   * O teto é propriedade do link, e o link não muda quando a tela muda: a busca não recomeça do
   * ponto de partida — dois minutos ou mais para reconquistar o que já estava medido.
   */
  it('trocar de tela não derruba o governador: `ativo` fica de pé e o teto aprendido sobrevive', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras, batida } = montar(sala)
    await ligar()
    amostras(35, FOLGADO)
    await assentar()
    expect(result.current.governador.tetoKbps).toBe(10_000)

    let promessa: Promise<void> | undefined
    act(() => {
      promessa = result.current.trocarDeTela()
    })
    // Uma batida por chamada ao SDK: o seletor, a troca da imagem e a do som.
    for (let passo = 0; passo < 3; passo += 1) {
      await batida()
      expect(result.current.ativo).toBe(true)
      expect(result.current.governador.tetoKbps).toBe(10_000)
    }

    await act(async () => {
      await promessa
    })
    expect(result.current.ativo).toBe(true)
    expect(result.current.perfilEfetivo.tetoKbps).toBe(10_000)
  })
})
