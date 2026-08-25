import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionState } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { NavegacaoDaSala } from '../src/telas/Sala/NavegacaoDaSala'
import { peca } from './apoio/pecas'

describe('navegação da sala', () => {
  it('organiza canal, pessoas e compartilhamentos sem esconder os estados de voz', () => {
    render(
      <NavegacaoDaSala
        nomeDaSala="Jogatina"
        nomeDaPessoa="Ana"
        conexao={ConnectionState.Connected}
        pessoas={[peca('Ana', { proprio: true, microfoneLigado: true }), peca('Bia', { microfoneLigado: false })]}
        telas={[peca('Bia', { ehTela: true })]}
        aoVoltar={vi.fn()}
      />,
    )

    const navegacao = screen.getByRole('navigation', { name: 'Navegação da sala' })
    expect(within(navegacao).getByText('Sala ao vivo')).toBeInTheDocument()
    expect(within(navegacao).getAllByText('Ana')).toHaveLength(2)
    expect(within(navegacao).getByText('Bia')).toBeInTheDocument()
    expect(within(navegacao).getByText('Tela de Bia')).toBeInTheDocument()
    expect(within(navegacao).getByTitle('microfone aberto')).toBeInTheDocument()
    expect(within(navegacao).getByTitle('microfone fechado')).toBeInTheDocument()
  })

  it('volta ao saguão pela marca', async () => {
    const aoVoltar = vi.fn()
    render(
      <NavegacaoDaSala
        nomeDaSala="Jogatina"
        nomeDaPessoa="Ana"
        conexao={ConnectionState.Connected}
        pessoas={[]}
        telas={[]}
        aoVoltar={aoVoltar}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao saguão' }))
    expect(aoVoltar).toHaveBeenCalledOnce()
  })

  it('abre e fecha canais e pessoas pelo atalho da composição estreita', () => {
    render(
      <NavegacaoDaSala
        nomeDaSala="Jogatina"
        nomeDaPessoa="Ana"
        conexao={ConnectionState.Connected}
        pessoas={[]}
        telas={[]}
        aoVoltar={vi.fn()}
      />,
    )

    const navegacao = screen.getByRole('navigation', { name: 'Navegação da sala' })
    const abrir = navegacao.querySelector<HTMLButtonElement>('button[aria-controls="painel-canais"]')
    if (!abrir) throw new Error('atalho dos canais não encontrado')
    fireEvent.click(abrir)

    expect(navegacao).toHaveAttribute('data-canais-abertos')
    expect(abrir).toHaveAttribute('aria-expanded', 'true')

    const botoesDeFechar = navegacao.querySelectorAll<HTMLButtonElement>('button[aria-label="Fechar canais e pessoas"]')
    fireEvent.click(botoesDeFechar[1]!)
    expect(navegacao).not.toHaveAttribute('data-canais-abertos')
  })

  it('distingue reconexão de uma conexão inicial', () => {
    render(
      <NavegacaoDaSala
        nomeDaSala="Jogatina"
        nomeDaPessoa="Ana"
        conexao={ConnectionState.Reconnecting}
        pessoas={[]}
        telas={[]}
        aoVoltar={vi.fn()}
      />,
    )

    expect(screen.getByText('reconectando…')).toBeInTheDocument()
    expect(screen.queryByText('conectando…')).not.toBeInTheDocument()
  })
})
