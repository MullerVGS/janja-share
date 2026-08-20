import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCliqueOuDuplo } from '../src/sala/useCliqueOuDuplo'

function Alvo({ aoClicar, aoClicarDuplo }: { aoClicar: () => void; aoClicarDuplo: () => void }) {
  const handlers = useCliqueOuDuplo(aoClicar, aoClicarDuplo)
  return <div data-testid="alvo" {...handlers} />
}

function baixarESoltar(elemento: HTMLElement, x = 10, y = 10) {
  fireEvent.pointerDown(elemento, { pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(elemento, { pointerId: 1, clientX: x, clientY: y })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useCliqueOuDuplo', () => {
  it('clique só age depois de 250 ms', () => {
    const aoClicar = vi.fn()
    render(<Alvo aoClicar={aoClicar} aoClicarDuplo={vi.fn()} />)
    baixarESoltar(screen.getByTestId('alvo'))

    expect(aoClicar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(249))
    expect(aoClicar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it('um segundo clique dentro da janela cancela o simples e dispara só o duplo', () => {
    const aoClicar = vi.fn()
    const aoClicarDuplo = vi.fn()
    render(<Alvo aoClicar={aoClicar} aoClicarDuplo={aoClicarDuplo} />)
    const alvo = screen.getByTestId('alvo')

    baixarESoltar(alvo)
    act(() => vi.advanceTimersByTime(100))
    baixarESoltar(alvo)

    expect(aoClicarDuplo).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(250))
    expect(aoClicar).not.toHaveBeenCalled()
  })

  it('deslocamento maior que 5 px entre pointerdown e pointerup cancela o clique (é arraste)', () => {
    const aoClicar = vi.fn()
    render(<Alvo aoClicar={aoClicar} aoClicarDuplo={vi.fn()} />)
    const alvo = screen.getByTestId('alvo')

    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(alvo, { pointerId: 1, clientX: 6, clientY: 0 })
    act(() => vi.advanceTimersByTime(250))

    expect(aoClicar).not.toHaveBeenCalled()
  })

  it('desmontar com um clique pendente não dispara nada', () => {
    const aoClicar = vi.fn()
    const { unmount } = render(<Alvo aoClicar={aoClicar} aoClicarDuplo={vi.fn()} />)
    baixarESoltar(screen.getByTestId('alvo'))

    unmount()
    act(() => vi.advanceTimersByTime(250))

    expect(aoClicar).not.toHaveBeenCalled()
  })
})
