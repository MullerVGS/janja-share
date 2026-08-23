import { Track } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { capturarTela, type OpcoesDeCapturaDeTela } from '../src/sala/captura'
import { CAPTURA_DO_AUDIO_DA_TELA } from '../src/sala/audioDaTela'
import { PRESET_DO_CONTEUDO } from '../src/sala/qualidade'

/**
 * A captura é nossa e não do SDK por um motivo só: `windowAudio` não sobrevive à tradução do
 * `createScreenTracks`. O preço é reimplementar as quinze linhas que montam as faixas — e é
 * exatamente esse preço que estes testes cobram, porque errar ali não quebra nada visivelmente:
 * uma faixa sem `source` publica como câmera e some do palco de todo mundo.
 */

/** O mínimo de `MediaStreamTrack` que o `LocalTrack` do SDK toca ao ser construído. */
function faixaDeMidiaFalsa(kind: 'video' | 'audio'): MediaStreamTrack {
  return {
    kind,
    id: `${kind}-1`,
    label: kind,
    enabled: true,
    muted: false,
    readyState: 'live',
    contentHint: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getSettings: () => ({}),
    getConstraints: () => ({}),
    getCapabilities: () => ({}),
    applyConstraints: vi.fn(async () => {}),
    clone: vi.fn(),
    stop: vi.fn(),
  } as unknown as MediaStreamTrack
}

function fluxoFalso(faixas: MediaStreamTrack[]): MediaStream {
  return {
    getTracks: () => faixas,
    getVideoTracks: () => faixas.filter((faixa) => faixa.kind === 'video'),
    getAudioTracks: () => faixas.filter((faixa) => faixa.kind === 'audio'),
  } as unknown as MediaStream
}

/** Devolve o espião do `getDisplayMedia` com o fluxo que o seletor "escolheu". */
function seletorDevolvendo(faixas: MediaStreamTrack[]) {
  const getDisplayMedia = vi.fn(async (_opcoes?: OpcoesDeCapturaDeTela) => fluxoFalso(faixas))
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } })
  // O `LocalVideoTrack` do SDK embrulha a faixa num `MediaStream`, que o jsdom não tem.
  vi.stubGlobal(
    'MediaStream',
    class {
      constructor(public faixas: MediaStreamTrack[] = []) {}
    },
  )
  return getDisplayMedia
}

describe('capturarTela', () => {
  it('pede ao navegador as opções do perfil, incluindo o áudio de mídia', async () => {
    const getDisplayMedia = seletorDevolvendo([faixaDeMidiaFalsa('video')])

    await capturarTela(PRESET_DO_CONTEUDO.texto)

    const [opcoes] = getDisplayMedia.mock.calls[0] ?? []
    expect(opcoes?.audio).toEqual(CAPTURA_DO_AUDIO_DA_TELA)
    expect(opcoes?.windowAudio).toBe('window')
    expect(opcoes?.systemAudio).toBe('include')
  })

  it('marca a tela como tela e o som da tela como som da tela', async () => {
    seletorDevolvendo([faixaDeMidiaFalsa('video'), faixaDeMidiaFalsa('audio')])

    const faixas = await capturarTela(PRESET_DO_CONTEUDO.texto)

    expect(faixas.map((faixa) => faixa.source)).toEqual([Track.Source.ScreenShare, Track.Source.ScreenShareAudio])
  })

  it('a dica de conteúdo vai na faixa de vídeo, que é onde o encoder a lê', async () => {
    seletorDevolvendo([faixaDeMidiaFalsa('video')])

    const [tela] = await capturarTela(PRESET_DO_CONTEUDO.jogo)

    expect(tela?.mediaStreamTrack.contentHint).toBe('motion')
  })

  it('sem "compartilhar áudio" marcado, devolve só a tela', async () => {
    seletorDevolvendo([faixaDeMidiaFalsa('video')])

    const faixas = await capturarTela(PRESET_DO_CONTEUDO.texto)

    expect(faixas).toHaveLength(1)
    expect(faixas[0]?.kind).toBe(Track.Kind.Video)
  })

  it('fluxo sem vídeo é erro — e o áudio que veio junto morre em vez de ficar órfão', async () => {
    const som = faixaDeMidiaFalsa('audio')
    seletorDevolvendo([som])

    await expect(capturarTela(PRESET_DO_CONTEUDO.texto)).rejects.toThrow()
    expect(som.stop).toHaveBeenCalled()
  })
})
