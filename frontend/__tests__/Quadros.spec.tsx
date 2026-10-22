import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionQuality, ConnectionState } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { Faixa, Grade } from '../src/telas/Sala/Quadros'
import { peca, volumesFalsos } from './apoio/pecas'

function grade(pecas = [peca('Bia', { ehTela: true }), peca('Bia'), peca('Caio', { microfoneLigado: false })]) {
  const aoEscolher = vi.fn()
  render(<Grade pecas={pecas} aoEscolher={aoEscolher} volumes={volumesFalsos()} minhaConexao={ConnectionState.Connected} />)
  return aoEscolher
}

describe('a grade da chamada', () => {
  it('Telas e Pessoas são quadros do mesmo tipo, e o clique põe em foco', async () => {
    const usuario = userEvent.setup()
    const aoEscolher = grade()

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    await usuario.click(screen.getByRole('button', { name: 'Pôr Caio no palco' }))

    expect(aoEscolher.mock.calls).toEqual([['tela:Bia'], ['pessoa:Caio']])
  })

  it('a Tela leva o selo "Ao vivo" e o nome "Tela de"; a Pessoa leva o nome', () => {
    grade()
    const tela = screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }).parentElement as HTMLElement
    expect(within(tela).getByText('Ao vivo')).toBeInTheDocument()
    expect(within(tela).getByText('Tela de Bia')).toBeInTheDocument()
    const caio = screen.getByRole('button', { name: 'Pôr Caio no palco' }).parentElement as HTMLElement
    expect(within(caio).queryByText('Ao vivo')).not.toBeInTheDocument()
    expect(within(caio).getByText('Caio')).toBeInTheDocument()
  })

  it('quem fala ganha a marca no quadro', () => {
    grade([peca('Bia', { falando: true })])
    expect(screen.getByRole('button', { name: 'Pôr Bia no palco' }).parentElement).toHaveAttribute('data-falando')
  })

  it('a conexão ruim de outra pessoa aparece no quadro dela, a própria não', () => {
    grade([
      peca('Bia', { qualidade: ConnectionQuality.Lost }),
      peca('Caio', { redeFraca: true }),
      peca('Eu', { proprio: true, qualidade: ConnectionQuality.Lost }),
    ])
    expect(screen.getByRole('img', { name: 'Bia pode estar com problemas de conexão' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Caio pode estar com problemas de conexão' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Eu pode estar/ })).not.toBeInTheDocument()
  })

  it('a Tela que não chega diz isso por cima, curto', () => {
    grade([peca('Bia', { ehTela: true, pausada: true })])
    expect(screen.getByText('Pausada')).toBeInTheDocument()
  })
})

describe('a faixa do foco', () => {
  it('mostra os outros quadros pequenos, sem volume', () => {
    render(
      <Faixa
        pecas={[peca('Bia'), peca('Caio', { ehTela: true })]}
        aoEscolher={vi.fn()}
        volumes={volumesFalsos()}
        minhaConexao={ConnectionState.Connected}
        visivel
      />,
    )
    const faixa = screen.getByLabelText('Outros quadros da chamada')
    expect(within(faixa).getAllByRole('button')).toHaveLength(2)
    expect(within(faixa).queryByRole('slider')).not.toBeInTheDocument()
  })

  it('sem outros quadros, não há faixa', () => {
    render(<Faixa pecas={[]} aoEscolher={vi.fn()} volumes={volumesFalsos()} minhaConexao={ConnectionState.Connected} visivel />)
    expect(screen.queryByLabelText('Outros quadros da chamada')).not.toBeInTheDocument()
  })
})
