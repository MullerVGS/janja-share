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
  it('lista cada um pelo nome e clicar promove ao palco', async () => {
    const usuario = userEvent.setup()
    const { aoEscolher } = montarTira({
      pecas: [peca('Bia', { ehTela: true }), peca('Caio'), peca('Ana', { proprio: true })],
    })

    const promover = screen
      .getAllByRole('button', { name: /^Pôr / })
      .map((botao) => botao.getAttribute('aria-label'))
    expect(promover).toEqual(['Pôr a tela de Bia no palco', 'Pôr Caio no palco', 'Pôr você no palco'])

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(aoEscolher).toHaveBeenCalledWith('tela:Bia')
  })

  it('sem ninguém fora do destaque não há coluna nenhuma', () => {
    const { container } = montarTira()
    expect(container).toBeEmptyDOMElement()
  })

  it('quem está sem imagem aparece pelas iniciais, e quem fala se anuncia', () => {
    const { container } = montarTira({ pecas: [peca('Ana Paula', { falando: true })] })

    expect(screen.getByText('AP')).toBeInTheDocument()
    expect(container.querySelector('[data-falando]')).not.toBeNull()
  })

  it('o volume vem junto: calar uma voz não exige pôr aquele quadro no palco — e o clique não promove', async () => {
    const usuario = userEvent.setup()
    const { aoEscolher, volumes } = montarTira({
      pecas: [peca('Caio'), peca('Ana', { proprio: true })],
    })

    await usuario.click(screen.getByRole('button', { name: 'Calar a voz de Caio' }))

    expect(volumes.alternarMudo).toHaveBeenCalledWith('Caio', 'pessoa')
    expect(aoEscolher).not.toHaveBeenCalled()
    // O seu próprio quadro não tem volume local a regular.
    expect(screen.queryByRole('button', { name: /Calar a voz de Ana/ })).not.toBeInTheDocument()
  })
})
