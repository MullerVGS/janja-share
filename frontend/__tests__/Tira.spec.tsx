import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tira } from '../src/telas/Sala/Tira'
import { peca } from './apoio/pecas'

describe('tira de quem está fora do palco', () => {
  it('lista cada um pelo nome e clicar promove ao palco', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = vi.fn()
    render(
      <Tira
        pecas={[peca('Bia', { ehTela: true }), peca('Caio'), peca('Ana', { proprio: true })]}
        aoEscolher={aoEscolher}
      />,
    )

    expect(screen.getAllByRole('button').map((botao) => botao.getAttribute('aria-label'))).toEqual([
      'Pôr a tela de Bia no palco',
      'Pôr Caio no palco',
      'Pôr você no palco',
    ])

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(aoEscolher).toHaveBeenCalledWith('tela:Bia')
  })

  it('sem ninguém fora do palco não há tira nenhuma', () => {
    const { container } = render(<Tira pecas={[]} aoEscolher={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('quem está sem imagem aparece pelas iniciais, e quem fala se anuncia', () => {
    render(<Tira pecas={[peca('Ana Paula', { falando: true })]} aoEscolher={vi.fn()} />)

    expect(screen.getByText('AP')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('data-falando', 'true')
  })
})
