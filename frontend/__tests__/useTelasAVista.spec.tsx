import { act, renderHook } from '@testing-library/react'
import { Track, type Room } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RESPIRO_DA_ABA_MS, RESPIRO_DA_PILHA_MS, type Vista } from '../src/sala/aVista'
import { useTelasAVista } from '../src/sala/useTelasAVista'

/** Uma Tela alheia reduzida ao que a pausa usa: o pedido, o que o SDK lembra e a faixa. */
function tela() {
  const t = {
    source: Track.Source.ScreenShare,
    isDesired: true,
    isEnabled: true,
    track: {} as object | undefined,
    setEnabled: vi.fn((ligada: boolean) => {
      t.isEnabled = ligada
    }),
    emitTrackUpdate: vi.fn(),
  }
  return t
}
type Tela = ReturnType<typeof tela>

function salaCom(telas: Record<string, Tela>) {
  const participantes = Object.entries(telas).map(([identity, publicacao]) => [
    identity,
    { identity, getTrackPublication: (fonte: Track.Source) => (fonte === publicacao.source ? publicacao : undefined) },
  ])
  return { remoteParticipants: new Map(participantes as [string, unknown][]) } as unknown as Room
}

/** O relógio que vence muda estado do hook: avançar dentro de `act` deixa a passada seguinte acontecer. */
const passar = (ms: number) => act(() => vi.advanceTimersByTime(ms))

const FOCO_NA_BIA: Vista = { foco: 'bia', pilhaVisivel: false, abaVisivel: true, janelinha: false }

describe('useTelasAVista', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function montar(telas: Record<string, Tela>, vista: Vista) {
    const sala = salaCom(telas)
    return renderHook(({ versao, vista }) => useTelasAVista(sala, versao, vista), { initialProps: { versao: 0, vista } })
  }

  it('a miniatura escondida pausa depois do respiro, e a Tela em foco nunca', () => {
    const bia = tela()
    const caio = tela()
    montar({ bia, caio }, FOCO_NA_BIA)

    passar(RESPIRO_DA_PILHA_MS - 1)
    expect(caio.setEnabled).not.toHaveBeenCalled()
    passar(1)
    expect(caio.setEnabled).toHaveBeenLastCalledWith(false)
    expect(bia.setEnabled).not.toHaveBeenCalled()
  })

  it('a pilha que volta antes do respiro não pausa nada; depois dele, religa na hora', () => {
    const caio = tela()
    const { rerender } = montar({ bia: tela(), caio }, FOCO_NA_BIA)

    passar(RESPIRO_DA_PILHA_MS / 2)
    rerender({ versao: 0, vista: { ...FOCO_NA_BIA, pilhaVisivel: true } })
    passar(RESPIRO_DA_PILHA_MS)
    expect(caio.setEnabled).not.toHaveBeenCalled()

    rerender({ versao: 0, vista: FOCO_NA_BIA })
    passar(RESPIRO_DA_PILHA_MS)
    expect(caio.isEnabled).toBe(false)
    rerender({ versao: 0, vista: { ...FOCO_NA_BIA, pilhaVisivel: true } })
    expect(caio.isEnabled).toBe(true)
  })

  it('a aba escondida pausa também a Tela em foco, com o respiro mais longo', () => {
    const bia = tela()
    montar({ bia }, { ...FOCO_NA_BIA, abaVisivel: false })

    passar(RESPIRO_DA_PILHA_MS)
    expect(bia.isEnabled).toBe(true)
    passar(RESPIRO_DA_ABA_MS - RESPIRO_DA_PILHA_MS)
    expect(bia.isEnabled).toBe(false)
  })

  it('a Tela deixada de ver não é tocada', () => {
    const caio = tela()
    caio.isDesired = false
    montar({ bia: tela(), caio }, FOCO_NA_BIA)
    passar(RESPIRO_DA_ABA_MS)
    expect(caio.setEnabled).not.toHaveBeenCalled()
  })

  it('assinatura refeita com a Tela pausada: a faixa nova recebe o pedido de pausa de novo', () => {
    const caio = tela()
    const { rerender } = montar({ bia: tela(), caio }, FOCO_NA_BIA)
    passar(RESPIRO_DA_PILHA_MS)
    expect(caio.isEnabled).toBe(false)
    expect(caio.emitTrackUpdate).not.toHaveBeenCalled()

    // O SFU esqueceu (assinatura nova, faixa nova); o SDK ainda lembra a pausa e não a repete.
    caio.track = {}
    rerender({ versao: 1, vista: FOCO_NA_BIA })
    expect(caio.emitTrackUpdate).toHaveBeenCalledTimes(1)
    rerender({ versao: 2, vista: FOCO_NA_BIA })
    expect(caio.emitTrackUpdate).toHaveBeenCalledTimes(1)
  })
})
