import { act, renderHook } from '@testing-library/react'
import { Track, type Room, type TrackPublishOptions } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gravarPreferencias, lerPreferencias } from '../src/preferencias'
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
type Publicacao = { trackSid: string; track: Faixa; options?: TrackPublishOptions }

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
  private pendentes: (() => void)[] = []

  localParticipant = {
    getTrackPublication: (fonte: Track.Source) => this.publicacoes.get(fonte),

    setScreenShareEnabled: vi.fn(async (ligar: boolean, _captura?: unknown, opcoes?: TrackPublishOptions) => {
      await this.proximaBatida()
      if (!ligar) {
        this.publicacoes.delete(Track.Source.ScreenShare)
        this.publicacoes.delete(Track.Source.ScreenShareAudio)
        return undefined
      }
      const video = this.publicar(Track.Source.ScreenShare, faixaFalsa('video', opcoes?.videoCodec), opcoes)
      if (this.comAudio) this.publicar(Track.Source.ScreenShareAudio, faixaFalsa('audio', undefined))
      return video
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

  private publicar(fonte: Track.Source, faixa: Faixa, options?: TrackPublishOptions): Publicacao {
    this.sids += 1
    faixa.sender = faixa.sender ?? faixaFalsa(faixa.kind).sender
    const publicacao = { trackSid: `t${this.sids}`, track: faixa, options }
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
    const [, captura, opcoes] = sala.localParticipant.setScreenShareEnabled.mock.calls[0] ?? []
    expect(captura).toMatchObject({ contentHint: 'text' })
    expect(opcoes).toMatchObject({ videoCodec: 'vp9', scalabilityMode: 'L1T2' })

    await ligar()
    expect(result.current.ativo).toBe(false)
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

    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))

    const { unpublishTrack, publishTrack } = sala.localParticipant
    expect(unpublishTrack.mock.calls).toEqual([
      [faixaDeVideo, false],
      [faixaDeAudio, false],
    ])
    expect(publishTrack).toHaveBeenCalledTimes(2)
    expect(publishTrack.mock.calls[0]?.[0]).toBe(faixaDeVideo)
    expect(publishTrack.mock.calls[0]?.[1]).toMatchObject({ videoCodec: 'av1', backupCodec: false, scalabilityMode: 'L1T2' })
    expect(publishTrack.mock.calls[1]).toEqual([faixaDeAudio, { source: Track.Source.ScreenShareAudio }])

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
  })

  it('Reiniciar transmissão para e começa de novo com o perfil pedido, e limpa o pendente', async () => {
    const sala = new SalaFalsa()
    const { result, ligar, agir } = montar(sala)
    await ligar()
    sala.localParticipant.publishTrack.mockRejectedValueOnce(new Error('nope'))
    await agir(() => result.current.definirPerfil({ ...result.current.perfil, codec: 'av1' }))
    expect(result.current.codecPendente).toBe('av1')
    sala.localParticipant.setScreenShareEnabled.mockClear()

    await agir(() => result.current.reiniciar())

    const chamadas = sala.localParticipant.setScreenShareEnabled.mock.calls
    expect(chamadas.map((chamada) => chamada[0])).toEqual([false, true])
    expect(chamadas[1]?.[2]).toMatchObject({ videoCodec: 'av1' })
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
