import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Gaveta } from '../src/telas/Sala/Gaveta'
import type { Resumo } from '../src/telas/Sala/resumo'

type Props = Parameters<typeof Gaveta>[0]

function montarProps(parcial: Partial<Props> = {}): Props {
  return {
    aberta: true,
    aba: 'qualidade',
    aoTrocarAba: vi.fn(),
    transmitindo: true,
    largura: 340,
    aoRedimensionar: vi.fn(),
    naoLidasNoChat: 0,
    resumo: null,
    qualidade: <p>painel de qualidade</p>,
    transmissao: <p>painel de transmissão</p>,
    chat: <p>painel de chat</p>,
    ...parcial,
  }
}

function montarGaveta(parcial: Partial<Props> = {}) {
  const props = montarProps(parcial)
  const resultado = render(<Gaveta {...props} />)
  return { ...props, resultado }
}

describe('gaveta da sala', () => {
  it('mostra as três abas e só o painel da aba ativa — menos o chat, que fica montado escondido', () => {
    montarGaveta({ aba: 'transmissao' })

    expect(screen.getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Chat', 'Qualidade', 'Transmissão'])
    expect(screen.getByRole('tab', { name: 'Transmissão' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('painel de transmissão')).toBeVisible()
    expect(screen.queryByText('painel de qualidade')).not.toBeInTheDocument()
    expect(screen.getByText('painel de chat')).not.toBeVisible()
  })

  it('a aba de Qualidade só existe enquanto você transmite', () => {
    const { resultado } = montarGaveta({ aba: 'qualidade' })
    expect(screen.getByText('painel de qualidade')).toBeVisible()

    // Quem corrige a aba ao parar de transmitir é a Sala; aqui ela chega já corrigida.
    resultado.rerender(<Gaveta {...montarProps({ aba: 'chat', transmitindo: false })} />)

    expect(screen.getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Chat', 'Transmissão'])
    expect(screen.queryByText('painel de qualidade')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('painel de chat')).toBeVisible()
  })

  it('clicar numa aba pede a troca', async () => {
    const usuario = userEvent.setup()
    const { aoTrocarAba } = montarGaveta()

    await usuario.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(aoTrocarAba).toHaveBeenCalledWith('chat')
  })

  it('a aba do chat carrega o contador de não lidas; zero não aparece', () => {
    const { resultado } = montarGaveta({ naoLidasNoChat: 3 })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('3')
    expect(screen.getByLabelText('3 mensagens não lidas')).toBeInTheDocument()

    resultado.rerender(<Gaveta {...montarProps({ naoLidasNoChat: 0 })} />)
    expect(screen.queryByLabelText(/não lidas/)).not.toBeInTheDocument()
  })

  it('fechada, sai da árvore e do caminho do teclado, mas o chat continua montado', () => {
    montarGaveta({ aberta: false, aba: 'chat' })

    const gaveta = screen.getByRole('complementary', { hidden: true })
    expect(gaveta).toHaveAttribute('aria-hidden', 'true')
    expect(gaveta).toHaveAttribute('inert')
    expect(screen.getByText('painel de chat')).toBeInTheDocument()
  })

  it('aberta, volta à árvore', () => {
    montarGaveta({ aberta: true })
    const gaveta = screen.getByRole('complementary')
    expect(gaveta).not.toHaveAttribute('aria-hidden')
    expect(gaveta).not.toHaveAttribute('inert')
  })

  it('a barra de resumo só existe transmitindo; o clique leva à Transmissão', async () => {
    const usuario = userEvent.setup()
    const { resultado, aoTrocarAba } = montarGaveta()
    expect(screen.queryByRole('button', { name: /resumo/i })).not.toBeInTheDocument()

    const resumo: Resumo = { partes: ['VP9', '1080p', '30 fps', '3,0 Mb/s'], estado: 'ok', tom: 'ok' }
    resultado.rerender(<Gaveta {...montarProps({ resumo, aoTrocarAba })} />)
    const barra = screen.getByRole('button', { name: /resumo da transmissão/i })
    expect(barra).toHaveTextContent('VP9 · 1080p · 30 fps · 3,0 Mb/s · ok')
    expect(barra).toHaveAttribute('data-tom', 'ok')

    await usuario.click(barra)
    expect(aoTrocarAba).toHaveBeenCalledWith('transmissao')
  })

  it('a largura vem por variável CSS e o arraste do divisor a muda, dentro dos limites, persistindo ao soltar', () => {
    vi.stubGlobal('innerWidth', 1600)
    const { aoRedimensionar } = montarGaveta({ largura: 340 })
    const gaveta = screen.getByRole('complementary')
    expect(gaveta.style.getPropertyValue('--largura-da-gaveta')).toBe('340px')

    const divisor = screen.getByRole('separator')
    fireEvent.pointerDown(divisor, { pointerId: 1, clientX: 1260 })
    fireEvent.pointerMove(divisor, { pointerId: 1, clientX: 1100 })
    // Por pixel só a variável muda; ninguém é avisado até soltar.
    expect(gaveta.style.getPropertyValue('--largura-da-gaveta')).toBe('500px')
    expect(aoRedimensionar).not.toHaveBeenCalled()

    fireEvent.pointerMove(divisor, { pointerId: 1, clientX: 100 })
    expect(gaveta.style.getPropertyValue('--largura-da-gaveta')).toBe('800px')

    fireEvent.pointerUp(divisor, { pointerId: 1, clientX: 100 })
    expect(aoRedimensionar).toHaveBeenCalledWith(800)
  })

  it('o divisor também anda pelo teclado', () => {
    vi.stubGlobal('innerWidth', 1600)
    const { aoRedimensionar } = montarGaveta({ largura: 340 })
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' })
    expect(aoRedimensionar).toHaveBeenCalledWith(356)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' })
    expect(aoRedimensionar).toHaveBeenCalledWith(324)
  })
})
