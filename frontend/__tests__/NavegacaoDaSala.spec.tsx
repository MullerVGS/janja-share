import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionState } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { NavegacaoDaSala } from '../src/telas/Sala/NavegacaoDaSala'
import { peca } from './apoio/pecas'

type Props = Parameters<typeof NavegacaoDaSala>[0]

function montarNavegacao(parcial: Partial<Props> = {}) {
  const props: Props = {
    nomeDaSala: 'Jogatina',
    nomeDaPessoa: 'Ana',
    conexao: ConnectionState.Connected,
    pessoas: [],
    telas: [],
    emDestaque: null,
    aoFocar: vi.fn(),
    aberta: true,
    aoRecolher: vi.fn(),
    conviteCopiado: false,
    aoCopiarConvite: vi.fn(),
    aoSair: vi.fn(),
    ...parcial,
  }
  return { ...props, ...render(<NavegacaoDaSala {...props} />) }
}

function painel() {
  return screen.getByRole('navigation', { name: 'Pessoas e telas da sala' })
}

describe('barra lateral da sala', () => {
  it('separa presença de imagem: uma lista de quem está e outra do que está no ar', () => {
    montarNavegacao({
      pessoas: [peca('Ana', { proprio: true, microfoneLigado: true }), peca('Bia', { microfoneLigado: false })],
      telas: [peca('Bia', { ehTela: true })],
    })

    const navegacao = painel()
    expect(within(navegacao).getByText('Na sala · 2')).toBeInTheDocument()
    expect(within(navegacao).getByText('Telas no ar · 1')).toBeInTheDocument()
    // A Bia aparece uma vez como pessoa e uma vez como tela — perguntas diferentes.
    expect(within(navegacao).getByText('Bia')).toBeInTheDocument()
    expect(within(navegacao).getByText('Tela de Bia')).toBeInTheDocument()
    expect(within(navegacao).getByText('você')).toBeInTheDocument()
    expect(within(navegacao).getByTitle('microfone aberto')).toBeInTheDocument()
    expect(within(navegacao).getByTitle('microfone fechado')).toBeInTheDocument()
  })

  it('quem está falando ganha a onda no lugar do microfone', () => {
    montarNavegacao({ pessoas: [peca('Bia', { microfoneLigado: true, falando: true })] })
    expect(within(painel()).getByTitle('falando')).toBeInTheDocument()
  })

  it('o subtítulo conta quantas telas estão no ar, no singular certo', () => {
    montarNavegacao({ telas: [peca('Bia', { ehTela: true })] })
    expect(screen.getByText('1 tela no ar')).toBeInTheDocument()

    montarNavegacao({ telas: [peca('Bia', { ehTela: true }), peca('Caio', { ehTela: true })] })
    expect(screen.getByText('2 telas no ar')).toBeInTheDocument()
  })

  it('a linha da tela põe aquela imagem no palco, e a que já está lá fica acesa', async () => {
    const usuario = userEvent.setup()
    const { aoFocar } = montarNavegacao({
      telas: [peca('Bia', { ehTela: true }), peca('Caio', { ehTela: true })],
      emDestaque: 'tela:Bia',
    })

    const daBia = screen.getByRole('button', { name: /Tela de Bia/ })
    expect(daBia).toHaveAttribute('data-ativa')
    const doCaio = screen.getByRole('button', { name: /Tela de Caio/ })
    expect(doCaio).not.toHaveAttribute('data-ativa')

    await usuario.click(doCaio)
    expect(aoFocar).toHaveBeenCalledExactlyOnceWith('tela:Caio')
  })

  it('copiar convite e sair são as duas pontas do "estou aqui"', async () => {
    const usuario = userEvent.setup()
    const { aoCopiarConvite, aoSair } = montarNavegacao()

    await usuario.click(screen.getByRole('button', { name: 'Copiar convite' }))
    expect(aoCopiarConvite).toHaveBeenCalledOnce()

    await usuario.click(screen.getByRole('button', { name: 'Sair da sala' }))
    expect(aoSair).toHaveBeenCalledOnce()
  })

  it('copiado, o botão do convite muda de rótulo', () => {
    montarNavegacao({ conviteCopiado: true })
    expect(screen.getByRole('button', { name: 'Convite copiado' })).toBeInTheDocument()
  })

  it('recolhida, sai do caminho do teclado — montada não é o mesmo que alcançável', () => {
    montarNavegacao({ aberta: false })

    // Sem nome acessível de propósito: `aria-hidden` na raiz apaga o rótulo junto com o resto.
    const navegacao = screen.getByRole('navigation', { hidden: true })
    expect(navegacao).toHaveAttribute('aria-hidden', 'true')
    expect(navegacao).toHaveAttribute('inert')
    expect(navegacao).not.toHaveAttribute('data-aberta')
  })

  it('distingue reconexão de uma conexão inicial', () => {
    montarNavegacao({ conexao: ConnectionState.Reconnecting })

    expect(screen.getByText('reconectando…')).toBeInTheDocument()
    expect(screen.queryByText('conectando…')).not.toBeInTheDocument()
  })
})
