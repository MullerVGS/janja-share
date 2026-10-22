import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ESPERA_PELA_RESPOSTA_MS, SOZINHO_ANTES_DE_PERGUNTAR_MS, useAindaAi } from '../src/sala/useAindaAi'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAindaAi', () => {
  it('sozinho e sem Tela por 30 min, pergunta; sem resposta em 2 min, desiste', () => {
    const aoDesistir = vi.fn()
    const { result } = renderHook(() => useAindaAi(true, aoDesistir))

    act(() => vi.advanceTimersByTime(SOZINHO_ANTES_DE_PERGUNTAR_MS - 1))
    expect(result.current.perguntando).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.perguntando).toBe(true)

    act(() => vi.advanceTimersByTime(ESPERA_PELA_RESPOSTA_MS))
    expect(aoDesistir).toHaveBeenCalledOnce()
  })

  it('responder recomeça a conta', () => {
    const aoDesistir = vi.fn()
    const { result } = renderHook(() => useAindaAi(true, aoDesistir))
    act(() => vi.advanceTimersByTime(SOZINHO_ANTES_DE_PERGUNTAR_MS))
    act(() => result.current.responder())

    act(() => vi.advanceTimersByTime(ESPERA_PELA_RESPOSTA_MS))
    expect(aoDesistir).not.toHaveBeenCalled()
    expect(result.current.perguntando).toBe(false)
  })

  it('alguém chegar (ou uma Tela no ar) cancela a pergunta', () => {
    const aoDesistir = vi.fn()
    const { result, rerender } = renderHook(({ parado }) => useAindaAi(parado, aoDesistir), {
      initialProps: { parado: true },
    })
    act(() => vi.advanceTimersByTime(SOZINHO_ANTES_DE_PERGUNTAR_MS))
    rerender({ parado: false })
    expect(result.current.perguntando).toBe(false)
    act(() => vi.advanceTimersByTime(ESPERA_PELA_RESPOSTA_MS))
    expect(aoDesistir).not.toHaveBeenCalled()
  })
})
