import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoOcultar } from '../src/sala/useAutoOcultar'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAutoOcultar', () => {
  it('some depois de 2500 ms sem mover o ponteiro', () => {
    const { result } = renderHook(() => useAutoOcultar(false))
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(2499))
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(false)
  })

  it('mover o ponteiro traz de volta e reinicia a contagem', () => {
    const { result } = renderHook(() => useAutoOcultar(false))
    act(() => vi.advanceTimersByTime(2500))
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(true) // ainda dentro da nova janela de 2500 ms

    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(false) // 2500 ms desde o último movimento
  })

  it('travado nunca some, mesmo bem além dos 2500 ms', () => {
    const { result } = renderHook(() => useAutoOcultar(true))
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current).toBe(true)
  })

  it('destravar recomeça o relógio do zero, sem herdar o tempo já passado travado', () => {
    const { result, rerender } = renderHook(({ travado }) => useAutoOcultar(travado), { initialProps: { travado: true } })

    act(() => vi.advanceTimersByTime(2000))
    rerender({ travado: false })

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(true) // só 2000 ms desde o destravar

    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(false) // 2500 ms desde o destravar
  })

  it('aceita o atraso como parâmetro (a pílula em tela cheia usa 2000 ms, não o default de 2500)', () => {
    const { result } = renderHook(() => useAutoOcultar(false, 2000))
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(1999))
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(false)
  })

  it('mover o ponteiro sem trocar visível/oculto não causa re-render — só a transição muda estado', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useAutoOcultar(false)
    })
    expect(renders).toBe(1)

    // Já está visível: mexer o ponteiro várias vezes não pode gerar render novo.
    act(() => {
      window.dispatchEvent(new Event('pointermove'))
      window.dispatchEvent(new Event('pointermove'))
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(renders).toBe(1)
    expect(result.current).toBe(true)

    // Some: exatamente 1 render para a transição visível → oculto.
    act(() => vi.advanceTimersByTime(2500))
    expect(renders).toBe(2)
    expect(result.current).toBe(false)

    // Volta: exatamente 1 render para a transição oculto → visível.
    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(renders).toBe(3)
    expect(result.current).toBe(true)
  })
})
