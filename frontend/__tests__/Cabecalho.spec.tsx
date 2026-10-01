import { render, screen } from '@testing-library/react'
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
    aoAlternarLateral: vi.fn(),
    lateralAberta: false,
    abaAMostra: null,
    aoAlternarAba: vi.fn(),
    conviteCopiado: false,
    aoCopiarConvite: vi.fn(),
    ...parcial,
  }
  return { ...props, ...render(<Cabecalho {...props} />) }
}

describe('cabeçalho da sala', () => {
  it('conectado: nome da sala, a tag de efêmera, a contagem e o pulso aceso', () => {
    const { container } = montarCabecalho()

    expect(screen.getByText('Jogatina')).toBeInTheDocument()
    expect(screen.getByText('efêmera')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('conectado')).toBeInTheDocument()
    expect(container.querySelector('[data-conectado]')).toBeInTheDocument()
  })

  it('enquanto não conecta, a frase da conexão troca e o pulso fica apagado', () => {
    const { container } = montarCabecalho({ conexao: ConnectionState.Reconnecting })

    expect(screen.getByText('reconectando…')).toBeInTheDocument()
    expect(screen.queryByText('conectado')).not.toBeInTheDocument()
    expect(container.querySelector('[data-conectado]')).not.toBeInTheDocument()
  })

  it('o botão de pessoas se anuncia pelo estado da barra lateral e pede a troca', async () => {
    const usuario = userEvent.setup()
    const { aoAlternarLateral } = montarCabecalho()

    const botao = screen.getByRole('button', { name: 'Pessoas e telas' })
    expect(botao).toHaveAttribute('aria-pressed', 'false')
    await usuario.click(botao)
    expect(aoAlternarLateral).toHaveBeenCalledOnce()

    montarCabecalho({ lateralAberta: true })
    expect(screen.getAllByRole('button', { name: 'Pessoas e telas' })[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('copiar convite delega para a sala, que é quem sabe quando o aviso já passou', async () => {
    const usuario = userEvent.setup()
    const { aoCopiarConvite } = montarCabecalho()

    await usuario.click(screen.getByRole('button', { name: 'Copiar convite' }))
    expect(aoCopiarConvite).toHaveBeenCalledOnce()

    montarCabecalho({ conviteCopiado: true })
    expect(screen.getByRole('button', { name: 'Convite copiado!' })).toBeInTheDocument()
  })

  it('o convite mostra a palavra junto do ícone', () => {
    montarCabecalho()
    expect(screen.getByRole('button', { name: 'Copiar convite' })).toHaveTextContent('Convidar')
  })

  it('só as métricas moram no topo: chat e qualidade ficam na barra, sem botão repetido', () => {
    montarCabecalho()
    expect(screen.getByRole('button', { name: 'Métricas da transmissão' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conversa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Qualidade da transmissão' })).not.toBeInTheDocument()
  })

  it('o botão das métricas fica marcado com a aba à mostra, e clicar nele pede a troca', async () => {
    const usuario = userEvent.setup()
    const { aoAlternarAba } = montarCabecalho({ abaAMostra: 'metricas' })

    expect(screen.getByRole('button', { name: 'Métricas da transmissão' })).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Métricas da transmissão' }))
    expect(aoAlternarAba).toHaveBeenCalledExactlyOnceWith('metricas')
  })
})
