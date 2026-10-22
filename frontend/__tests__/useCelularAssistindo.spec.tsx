import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FRASE_DE_VOLTA, useCelularAssistindo } from '../src/sala/useCelularAssistindo'

function visibilidade(estado: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function toque(sim: boolean) {
  window.matchMedia = vi.fn((consulta: string) => ({
    matches: sim && consulta === '(pointer: coarse)',
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  Reflect.deleteProperty(window, 'matchMedia')
  Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('useCelularAssistindo', () => {
  it('no celular, a aba que volta do fundo assistindo busca a mídia de novo e diz por quê', () => {
    toque(true)
    const aoVoltar = vi.fn()
    const { result } = renderHook(() => useCelularAssistindo({ assistindo: true, conectada: true, aoVoltar }))

    visibilidade('hidden')
    visibilidade('visible')

    expect(aoVoltar).toHaveBeenCalledOnce()
    expect(result.current).toBe(FRASE_DE_VOLTA)
  })

  it('no computador, trocar de aba não reassina nada', () => {
    toque(false)
    const aoVoltar = vi.fn()
    const { result } = renderHook(() => useCelularAssistindo({ assistindo: true, conectada: true, aoVoltar }))

    visibilidade('hidden')
    visibilidade('visible')

    expect(aoVoltar).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('assistindo, a tela do aparelho fica acesa; parar de assistir solta a trava', async () => {
    const soltar = vi.fn(async () => {})
    const pedir = vi.fn(async () => ({ release: soltar }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request: pedir }, configurable: true })
    const { rerender } = renderHook(({ assistindo }) => useCelularAssistindo({ assistindo, conectada: true, aoVoltar: vi.fn() }), {
      initialProps: { assistindo: true },
    })
    await act(async () => {})
    expect(pedir).toHaveBeenCalledWith('screen')

    rerender({ assistindo: false })
    expect(soltar).toHaveBeenCalledOnce()
  })
})
