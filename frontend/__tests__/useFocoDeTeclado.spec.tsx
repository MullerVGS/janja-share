import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocoDeTeclado } from '../src/sala/useFocoDeTeclado'

function Cenario({ comBotao = true }: { comBotao?: boolean }) {
  const alvo = useRef<HTMLDivElement>(null)
  const dentro = useFocoDeTeclado(alvo)
  return (
    <>
      <div ref={alvo}>
        {comBotao && (
          <button type="button" data-testid="dentro">
            dentro
          </button>
        )}
      </div>
      <button type="button" data-testid="fora">
        fora
      </button>
      <span data-testid="resposta">{String(dentro)}</span>
    </>
  )
}

const resposta = () => screen.getByTestId('resposta').textContent

function focar(id: string) {
  act(() => screen.getByTestId(id).focus())
}

function pelaTecla() {
  fireEvent.keyDown(document, { key: 'Tab' })
}

describe('useFocoDeTeclado', () => {
  it('foco que veio de um clique não conta — senão apertar um botão travaria a interface acesa', () => {
    render(<Cenario />)
    fireEvent.pointerDown(screen.getByTestId('dentro'))

    focar('dentro')

    expect(resposta()).toBe('false')
  })

  it('foco que veio do teclado conta', () => {
    render(<Cenario />)
    pelaTecla()

    focar('dentro')

    expect(resposta()).toBe('true')
  })

  it('o teclado saindo para fora do alvo desliga', () => {
    render(<Cenario />)
    pelaTecla()
    focar('dentro')

    focar('fora')

    expect(resposta()).toBe('false')
  })

  it('um clique em qualquer lugar desliga: a última entrada passou a ser o ponteiro', () => {
    render(<Cenario />)
    pelaTecla()
    focar('dentro')
    expect(resposta()).toBe('true')

    fireEvent.pointerDown(screen.getByTestId('fora'))

    expect(resposta()).toBe('false')
  })

  it('o elemento focado que some do DOM desliga — o Chrome não emite focusout por ele', () => {
    const { rerender } = render(<Cenario />)
    pelaTecla()
    focar('dentro')
    expect(resposta()).toBe('true')

    rerender(<Cenario comBotao={false} />)

    expect(resposta()).toBe('false')
  })
})
