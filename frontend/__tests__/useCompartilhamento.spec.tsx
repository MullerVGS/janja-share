import { act, renderHook } from '@testing-library/react'
import { Track, type LocalTrack, type Room, type TrackPublishOptions } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gravarPreferencias, lerPreferencias } from '../src/preferencias'
import { OPCOES_DO_AUDIO_DA_TELA } from '../src/sala/audioDaTela'
import { PERFIL_PADRAO, PRESET_DO_CONTEUDO } from '../src/sala/qualidade'
import { useCompartilhamento } from '../src/sala/useCompartilhamento'
import { amostraVaziaDoEmissor, type AmostraDoEmissor } from '../src/telemetria/amostra'
import { anotar, type Historico } from '../src/telemetria/historico'

/** Uma `LocalTrack` reduzida ao que o hook toca: a faixa do navegador, o sender e o codec publicado. */
function faixaFalsa(kind: 'video' | 'audio', codec: string | undefined = 'vp9') {
  const parametros = { transactionId: 'tx', encodings: [{ active: true }] } as unknown as RTCRtpSendParameters
  return {
    kind,
    codec: codec as string | undefined,
    isMuted: false,
    mediaStreamTrack: { readyState: 'live' as MediaStreamTrackState, contentHint: '', applyConstraints: vi.fn(async () => {}) },
    sender: {
      getParameters: () => parametros,
      setParameters: vi.fn(async (novos: RTCRtpSendParameters) => {
        Object.assign(parametros, novos)
      }),
    } as unknown as RTCRtpSender | undefined,
    parametros: () => parametros,
    stop: vi.fn(),
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
  /** O que o último `createScreenTracks` entregou — para conferir quem foi parado. */
  ultimaCaptura: Faixa[] = []
  private pendentes: (() => void)[] = []

  localParticipant = {
    getTrackPublication: (fonte: Track.Source) => this.publicacoes.get(fonte),

    // Só o desligar (`ligar()` captura e publica faixa a faixa via `createScreenTracks` +
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

    /** O seletor nativo aberto de novo: entrega faixas de captura sem publicar nada. */
    createScreenTracks: vi.fn(async (_captura?: unknown) => {
      await this.proximaBatida()
      const faixas = [faixaFalsa('video', undefined)]
      if (this.comAudio) faixas.push(faixaFalsa('audio', undefined))
      this.ultimaCaptura = faixas
      return faixas
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

function montar(sala: SalaFalsa) {
  let historico: Historico<AmostraDoEmissor> = []
  let emMs = 0
  const resultado = renderHook(({ historico }) => useCompartilhamento(sala as unknown as Room, historico), {
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
    gravarPreferencias({ perfil: { ...PRESET_DO_CONTEUDO.movimento, resolucao: '720p' }, automatico: false })
    const { result } = montar(new SalaFalsa())

    expect(result.current.perfil).toEqual({ ...PRESET_DO_CONTEUDO.movimento, resolucao: '720p' })
    expect(result.current.automatico).toBe(false)

    act(() => result.current.definirPerfil({ ...result.current.perfil, fps: 30 }))
    act(() => result.current.definirAutomatico(true))
    expect(lerPreferencias()).toMatchObject({ perfil: { ...PRESET_DO_CONTEUDO.movimento, resolucao: '720p', fps: 30 }, automatico: true })
  })

  it('ligar publica com as opções do perfil; desligar despublica', async () => {
    const sala = new SalaFalsa()
    const { result, ligar } = montar(sala)
    expect(result.current.ativo).toBe(false)

    await ligar()
    expect(result.current.ativo).toBe(true)
    const [captura] = sala.localParticipant.createScreenTracks.mock.calls[0] ?? []
    expect(captura).toMatchObject({ contentHint: 'text' })
    const [, opcoes] = sala.localParticipant.publishTrack.mock.calls[0] ?? []
    expect(opcoes).toMatchObject({ videoCodec: 'vp9', scalabilityMode: 'L1T2' })

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
    act(() => result.current.definirPerfil({ ...PERFIL_PADRAO, fps: 60 }))
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
    act(() => result.current.definirPerfil({ ...PERFIL_PADRAO, fps: 60 }))
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

  it('parar de compartilhar zera o governador', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, amostras } = montar(sala)
    act(() => result.current.definirPerfil({ ...PERFIL_PADRAO, fps: 60 }))
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

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))

    const { unpublishTrack, publishTrack } = sala.localParticipant
    expect(unpublishTrack.mock.calls).toEqual([
      [faixaDeVideo, false],
      [faixaDeAudio, false],
    ])
    expect(publishTrack).toHaveBeenCalledTimes(2)
    expect(publishTrack.mock.calls[0]?.[0]).toBe(faixaDeVideo)
    expect(publishTrack.mock.calls[0]?.[1]).toMatchObject({ videoCodec: 'av1', backupCodec: false, scalabilityMode: 'L1T2' })
    expect(publishTrack.mock.calls[1]).toEqual([faixaDeAudio, OPCOES_DO_AUDIO_DA_TELA])

    expect(sala.video()?.track).toBe(faixaDeVideo)
    expect(sala.video()?.trackSid).not.toBe(sidAntigo)
    expect(sala.video()?.track.codec).toBe('av1')
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
    expect(result.current.codecPendente).toBeNull()
    expect(faixaDeVideo?.mediaStreamTrack.readyState).toBe('live')
  })

  it('trocar o conteúdo troca o codec do preset e republica do mesmo jeito; sem áudio, só o vídeo', async () => {
    const sala = new SalaFalsa()
    sala.comAudio = false
    const { result, ligar, agir } = montar(sala)
    await ligar()
    // `ligar()` já publicou a faixa de vídeo na captura inicial; a contagem abaixo é só da republicação.
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.definirPerfil({ ...PRESET_DO_CONTEUDO.movimento }))

    expect(sala.localParticipant.unpublishTrack).toHaveBeenCalledTimes(1)
    expect(sala.localParticipant.publishTrack).toHaveBeenCalledTimes(1)
    expect(sala.video()?.track.codec).toBe('h264')
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

    act(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))
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

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))

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

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))

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

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))

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
    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))
    expect(result.current.codecPendente).toBe('av1')
    sala.localParticipant.setScreenShareEnabled.mockClear()
    sala.localParticipant.createScreenTracks.mockClear()
    sala.localParticipant.publishTrack.mockClear()

    await agir(() => result.current.reiniciar())

    // Reiniciar para (desligarAntes) e captura+publica de novo — não delega mais ao
    // `setScreenShareEnabled(true, ...)`, que aplicaria a mesma opção de vídeo ao áudio.
    expect(sala.localParticipant.setScreenShareEnabled).toHaveBeenCalledExactlyOnceWith(false)
    expect(sala.localParticipant.createScreenTracks).toHaveBeenCalledOnce()
    expect(sala.localParticipant.publishTrack.mock.calls[0]?.[1]).toMatchObject({ videoCodec: 'av1' })
    expect(result.current.codecPendente).toBeNull()
    expect(result.current.ativo).toBe(true)
    expect(sala.video()?.track.codec).toBe('av1')
  })

  it('um segundo pedido de codec durante a republicação é atendido depois dela', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, batida, ateAssentar, reler } = montar(sala)
    await ligar()

    act(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))
    await batida()
    act(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'h264' }))
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
   * codec. `setScreenShareEnabled` do SDK real publica toda faixa de `createScreenTracks` com o
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

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))

    expect(sala.video()?.track.codec).toBe('av1')
    expect(sala.audio()).toBeDefined()
    expect(sala.audio()?.isMuted).toBe(true)
  })
})

describe('useCompartilhamento: trocar de tela', () => {
  it('abre o seletor de novo e só derruba a tela antiga depois que a nova captura existe', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const antiga = sala.video()?.track
    // `ligar()` já chamou `createScreenTracks` na captura inicial; a contagem abaixo é só da troca.
    sala.localParticipant.createScreenTracks.mockClear()

    await agir(() => result.current.trocarDeTela())

    expect(sala.localParticipant.createScreenTracks).toHaveBeenCalledOnce()
    // A ordem é o que garante que cancelar não derruba nada: capturar vem antes de despublicar.
    expect(sala.localParticipant.createScreenTracks.mock.invocationCallOrder[0]).toBeLessThan(
      sala.localParticipant.setScreenShareEnabled.mock.invocationCallOrder[0] ?? Infinity,
    )
    expect(sala.video()?.track).not.toBe(antiga)
    expect(sala.video()?.options).toMatchObject({ videoCodec: 'vp9', scalabilityMode: 'L1T2' })
    expect(sala.audio()?.track.kind).toBe('audio')
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
    expect(result.current.erro).toBeNull()
    // A captura que foi ao ar continua viva; parar alguma delas mataria a transmissão nova.
    for (const faixa of sala.ultimaCaptura) expect(faixa.stop).not.toHaveBeenCalled()
  })

  it('se publicar a tela nova falhar, a captura recém-aberta morre — nada de indicador aceso para ninguém', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    sala.localParticipant.publishTrack.mockRejectedValueOnce(new Error('engine fechada'))

    await agir(() => result.current.trocarDeTela())

    for (const faixa of sala.ultimaCaptura) expect(faixa.stop).toHaveBeenCalledOnce()
    expect(result.current.erro).toBe('engine fechada')
    expect(result.current.ocupado).toBe(false)
  })

  it('cancelar o seletor não mexe em nada — a tela que estava no ar continua no ar', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    const antiga = sala.video()?.track
    const cancelou = Object.assign(new Error('cancelou'), { name: 'NotAllowedError' })
    sala.localParticipant.createScreenTracks.mockRejectedValueOnce(cancelou)

    await agir(() => result.current.trocarDeTela())

    expect(sala.video()?.track).toBe(antiga)
    // Cancelar não passa do `createScreenTracks`: nem o `setScreenShareEnabled(false)` do
    // meio de `trocarDeTela` roda.
    expect(sala.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled()
    expect(result.current.ativo).toBe(true)
    expect(result.current.erro).toBeNull()
  })

  it('sem tela no ar não há o que trocar', async () => {
    const sala = new SalaFalsa()
    const { result, agir } = montar(sala)

    await agir(() => result.current.trocarDeTela())

    expect(sala.localParticipant.createScreenTracks).not.toHaveBeenCalled()
  })

  it('trocandoTela fica true do início do unpublish até o fim do republish — é o aviso que Sala.tsx usa pra não expulsar o foco de quem estava vendo outra coisa (achado 9)', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, batida } = montar(sala)
    await ligar()
    expect(result.current.trocandoTela).toBe(false)

    let promessa: Promise<void> | undefined
    act(() => {
      promessa = result.current.trocarDeTela()
    })
    expect(result.current.trocandoTela).toBe(false) // ainda dentro do seletor nativo (createScreenTracks)

    await batida() // libera createScreenTracks; achou vídeo; liga trocandoTela; presa no unpublish
    expect(result.current.trocandoTela).toBe(true)
    expect(sala.video()).toBeDefined()

    await batida() // libera o unpublish — a própria tela some da lista aqui
    expect(result.current.trocandoTela).toBe(true)
    expect(sala.video()).toBeUndefined()

    await batida() // libera o republish do vídeo — a tela volta
    expect(result.current.trocandoTela).toBe(true)
    expect(sala.video()).toBeDefined()

    await batida() // libera o publish do áudio da tela — fim da troca
    expect(result.current.trocandoTela).toBe(false)

    await act(async () => {
      await promessa
    })
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
  })
})

describe('useCompartilhamento: adotar (a captura que a home já abriu)', () => {
  it('publica vídeo e áudio com as opções de cada um — mesmo padrão de ligar/trocarDeTela', async () => {
    const sala = new SalaFalsa()
    const { result, agir } = montar(sala)
    const video = faixaFalsa('video')
    const audio = faixaFalsa('audio')

    await agir(() => result.current.adotar([video, audio] as unknown as LocalTrack[]))

    expect(sala.video()?.track).toBe(video)
    expect(sala.video()?.options).toMatchObject({ videoCodec: 'vp9', scalabilityMode: 'L1T2' })
    expect(sala.audio()?.track).toBe(audio)
    expect(sala.audio()?.options).toEqual(OPCOES_DO_AUDIO_DA_TELA)
    expect(result.current.ativo).toBe(true)
    expect(result.current.ocupado).toBe(false)
    expect(result.current.erro).toBeNull()
  })

  it('sem vídeo entre as faixas, não há o que adotar — e o áudio sozinho é parado por pararOQueNaoFoiAoAr', async () => {
    const sala = new SalaFalsa()
    const { result, agir } = montar(sala)
    const audio = faixaFalsa('audio')

    await agir(() => result.current.adotar([audio] as unknown as LocalTrack[]))

    expect(sala.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(sala.audio()).toBeUndefined()
    expect(audio.stop).toHaveBeenCalledOnce()
    expect(result.current.ativo).toBe(false)
    expect(result.current.ocupado).toBe(false)
  })
})
