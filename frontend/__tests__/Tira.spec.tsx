import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tira } from '../src/telas/Sala/Tira'
import { peca, volumesFalsos } from './apoio/pecas'

type Props = Parameters<typeof Tira>[0]

function montarTira(parcial: Partial<Props> = {}) {
  const props: Props = {
    pecas: [],
    aoEscolher: vi.fn(),
    volumes: volumesFalsos(),
    visivel: true,
    ...parcial,
  }
  return { ...props, ...render(<Tira {...props} />) }
}

describe('miniaturas de quem está fora do destaque', () => {
  it('lista cada tela por quem a publica e clicar promove ao palco', async () => {
    const usuario = userEvent.setup()
    const { aoEscolher } = montarTira({
      pecas: [peca('Bia', { ehTela: true }), peca('Ana', { ehTela: true, proprio: true })],
    })

    const promover = screen
      .getAllByRole('button', { name: /^Pôr / })
      .map((botao) => botao.getAttribute('aria-label'))
    expect(promover).toEqual(['Pôr a tela de Bia no palco', 'Pôr a sua tela no palco'])

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(aoEscolher).toHaveBeenCalledWith('tela:Bia')
  })

  it('sem ninguém fora do destaque não há coluna nenhuma', () => {
    const { container } = montarTira()
    expect(container).toBeEmptyDOMElement()
  })

  it('o volume vem junto: calar o som de uma tela não exige pô-la no palco — e o clique não promove', async () => {
    const usuario = userEvent.setup()
    const { aoEscolher, volumes } = montarTira({
      pecas: [peca('Caio', { ehTela: true }), peca('Ana', { ehTela: true, proprio: true })],
    })

    await usuario.click(screen.getByRole('button', { name: 'Calar o som da tela de Caio' }))

    expect(volumes.alternarMudo).toHaveBeenCalledWith('Caio', 'tela')
    expect(aoEscolher).not.toHaveBeenCalled()
    // A sua própria tela não tem volume local a regular.
    expect(screen.queryByRole('button', { name: /Calar o som da tela de Ana/ })).not.toBeInTheDocument()
  })
})
