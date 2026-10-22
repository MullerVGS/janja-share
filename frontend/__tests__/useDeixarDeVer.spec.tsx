import { act, renderHook } from '@testing-library/react'
import { Track, type Room } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { useDeixarDeVer } from '../src/sala/useDeixarDeVer'

/** Uma publicação remota reduzida à assinatura: o que se pede e o que se lê de volta. */
function publicacao(source: Track.Source) {
  const p = {
    source,
    isDesired: true,
    setSubscribed: vi.fn((assinar: boolean) => {
      p.isDesired = assinar
    }),
  }
  return p
}
type Publicacao = ReturnType<typeof publicacao>

function salaCom(publicacoes: Publicacao[]) {
  const bia = {
    identity: 'bia-x1y2',
    getTrackPublication: (fonte: Track.Source) => publicacoes.find((p) => p.source === fonte),
  }
  return { remoteParticipants: new Map([[bia.identity, bia]]) } as unknown as Room
}

describe('deixar de ver a tela de alguém', () => {
  it('desassina a imagem e o som da tela — a voz da pessoa continua', () => {
    const tela = publicacao(Track.Source.ScreenShare)
    const som = publicacao(Track.Source.ScreenShareAudio)
    const voz = publicacao(Track.Source.Microphone)
    const sala = salaCom([tela, som, voz])
    const { result } = renderHook(() => useDeixarDeVer(sala, 0))

    act(() => result.current.deixarDeVer('bia-x1y2'))

    expect(result.current.naoVejo.has('bia-x1y2')).toBe(true)
    expect(tela.setSubscribed).toHaveBeenCalledWith(false)
    expect(som.setSubscribed).toHaveBeenCalledWith(false)
    expect(voz.setSubscribed).not.toHaveBeenCalled()
  })

  it('a Tela nova da mesma pessoa chega assinada e é desassinada no palco seguinte — a escolha é pela pessoa', () => {
    const publicacoes = [publicacao(Track.Source.ScreenShare)]
    const sala = salaCom(publicacoes)
    const { result, rerender } = renderHook(({ versao }) => useDeixarDeVer(sala, versao), { initialProps: { versao: 0 } })
    act(() => result.current.deixarDeVer('bia-x1y2'))

    const nova = publicacao(Track.Source.ScreenShare)
    publicacoes.splice(0, 1, nova)
    rerender({ versao: 1 })

    expect(nova.setSubscribed).toHaveBeenCalledWith(false)
  })

  it('ver de novo assina de volta com um clique, e o palco seguinte não desassina', () => {
    const tela = publicacao(Track.Source.ScreenShare)
    const sala = salaCom([tela])
    const { result, rerender } = renderHook(({ versao }) => useDeixarDeVer(sala, versao), { initialProps: { versao: 0 } })
    act(() => result.current.deixarDeVer('bia-x1y2'))

    act(() => result.current.verDeNovo('bia-x1y2'))
    rerender({ versao: 1 })

    expect(tela.setSubscribed).toHaveBeenLastCalledWith(true)
    expect(tela.isDesired).toBe(true)
    expect(result.current.naoVejo.size).toBe(0)
  })

  it('quem não foi deixado não é tocado — nem quando a reassinatura do cão de guarda o desassina por um instante', () => {
    const tela = publicacao(Track.Source.ScreenShare)
    tela.isDesired = false
    const sala = salaCom([tela])
    const { rerender } = renderHook(({ versao }) => useDeixarDeVer(sala, versao), { initialProps: { versao: 0 } })

    rerender({ versao: 1 })

    expect(tela.setSubscribed).not.toHaveBeenCalled()
  })
})
