import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionState } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { Cabecalho } from '../src/telas/Sala/Cabecalho'

type Props = Parameters<typeof Cabecalho>[0]

function montarCabecalho(parcial: Partial<Props> = {}) {
  const props: Props = {
    nomeDaSala: 'Jogatina',
    conexao: ConnectionState.Connected,
    pessoas: 3,
    gavetaAberta: false,
    aoAlternarGaveta: vi.fn(),
    ...parcial,
  }
  return { ...props, ...render(<Cabecalho {...props} />) }
}

describe('cabeçalho flutuante', () => {
  it('conectado: nome da sala, contagem e o pulso aceso', () => {
    const { container } = montarCabecalho()

    expect(screen.getByText('Jogatina')).toBeInTheDocument()
    expect(screen.getByText('3 pessoas')).toBeInTheDocument()
    expect(container.querySelector('[data-conectado]')).toBeInTheDocument()
  })

  it('uma pessoa só não vira "1 pessoas"', () => {
    montarCabecalho({ pessoas: 1 })
    expect(screen.getByText('1 pessoa')).toBeInTheDocument()
  })

  it('enquanto não conecta, a frase da conexão ocupa o lugar da contagem e o pulso fica apagado', () => {
    const { container } = montarCabecalho({ conexao: ConnectionState.Reconnecting })

    expect(screen.getByText('Reconectando…')).toBeInTheDocument()
    expect(screen.queryByText('3 pessoas')).not.toBeInTheDocument()
    expect(container.querySelector('[data-conectado]')).not.toBeInTheDocument()
  })

  it('o botão da gaveta se anuncia pelo estado dela e pede a troca', async () => {
    const usuario = userEvent.setup()
    const { aoAlternarGaveta } = montarCabecalho()

    const botao = screen.getByRole('button', { name: 'Abrir o painel' })
    expect(botao).toHaveAttribute('aria-pressed', 'false')
    await usuario.click(botao)
    expect(aoAlternarGaveta).toHaveBeenCalledOnce()

    montarCabecalho({ gavetaAberta: true })
    expect(screen.getByRole('button', { name: 'Fechar o painel' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('copiar link chama writeText com a URL da página e avisa "copiado" por 2 s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async (_texto: string) => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    montarCabecalho()
    // `fireEvent` e não `userEvent`: com timers falsos o userEvent espera um relógio que não anda.
    const clicarEmCopiar = () =>
      act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copiar link' })))

    await clicarEmCopiar()

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(screen.getByRole('button', { name: 'Link copiado!' })).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
