import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Lateral } from '../src/telas/Sala/Lateral'
import type { Resumo } from '../src/telas/Sala/resumo'

type Props = Parameters<typeof Lateral>[0]

function montarProps(parcial: Partial<Props> = {}): Props {
  return {
    aberta: true,
    aba: 'qualidade',
    aoTrocarAba: vi.fn(),
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

function montarLateral(parcial: Partial<Props> = {}) {
  const props = montarProps(parcial)
  const resultado = render(<Lateral {...props} />)
  return { ...props, resultado }
}

describe('lateral da sala', () => {
  it('mostra as três abas e só o painel da aba ativa — menos o chat, que fica montado escondido', () => {
    montarLateral({ aba: 'transmissao' })

    expect(screen.getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Qualidade', 'Transmissão', 'Chat'])
    expect(screen.getByRole('tab', { name: 'Transmissão' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('painel de transmissão')).toBeVisible()
    expect(screen.queryByText('painel de qualidade')).not.toBeInTheDocument()
    expect(screen.getByText('painel de chat')).not.toBeVisible()
  })

  it('clicar numa aba pede a troca', async () => {
    const usuario = userEvent.setup()
    const { aoTrocarAba } = montarLateral()

    await usuario.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(aoTrocarAba).toHaveBeenCalledWith('chat')
  })

  it('a aba do chat carrega o contador de não lidas; zero não aparece', () => {
    const { resultado } = montarLateral({ naoLidasNoChat: 3 })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('3')
    expect(screen.getByLabelText('3 mensagens não lidas')).toBeInTheDocument()

    resultado.rerender(<Lateral {...montarProps({ naoLidasNoChat: 0 })} />)
    expect(screen.queryByLabelText(/não lidas/)).not.toBeInTheDocument()
  })

  it('fechada, some inteira mas o chat continua montado', () => {
    montarLateral({ aberta: false, aba: 'chat' })
    expect(screen.getByRole('complementary', { hidden: true })).not.toBeVisible()
    expect(screen.getByText('painel de chat')).toBeInTheDocument()
  })

  it('a barra de resumo só existe transmitindo; o clique leva à Transmissão', async () => {
    const usuario = userEvent.setup()
    const { resultado, aoTrocarAba } = montarLateral()
    expect(screen.queryByRole('button', { name: /resumo/i })).not.toBeInTheDocument()

    const resumo: Resumo = { partes: ['VP9', '1080p', '30 fps', '3,0 Mb/s'], estado: 'ok', tom: 'ok' }
    resultado.rerender(<Lateral {...montarProps({ resumo, aoTrocarAba })} />)
    const barra = screen.getByRole('button', { name: /resumo da transmissão/i })
    expect(barra).toHaveTextContent('VP9 · 1080p · 30 fps · 3,0 Mb/s · ok')
    expect(barra).toHaveAttribute('data-tom', 'ok')

    await usuario.click(barra)
    expect(aoTrocarAba).toHaveBeenCalledWith('transmissao')
  })

  it('a largura vem por variável CSS e o arraste do divisor a muda, dentro dos limites, persistindo ao soltar', () => {
    vi.stubGlobal('innerWidth', 1600)
    const { aoRedimensionar } = montarLateral({ largura: 340 })
    const lateral = screen.getByRole('complementary')
    expect(lateral.style.getPropertyValue('--largura-lateral')).toBe('340px')

    const divisor = screen.getByRole('separator')
    fireEvent.pointerDown(divisor, { pointerId: 1, clientX: 1260 })
    fireEvent.pointerMove(divisor, { pointerId: 1, clientX: 1100 })
    // Por pixel só a variável muda; ninguém é avisado até soltar.
    expect(lateral.style.getPropertyValue('--largura-lateral')).toBe('500px')
    expect(aoRedimensionar).not.toHaveBeenCalled()

    fireEvent.pointerMove(divisor, { pointerId: 1, clientX: 100 })
    expect(lateral.style.getPropertyValue('--largura-lateral')).toBe('800px')

    fireEvent.pointerUp(divisor, { pointerId: 1, clientX: 100 })
    expect(aoRedimensionar).toHaveBeenCalledWith(800)
  })

  it('o divisor também anda pelo teclado', () => {
    vi.stubGlobal('innerWidth', 1600)
    const { aoRedimensionar } = montarLateral({ largura: 340 })
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' })
    expect(aoRedimensionar).toHaveBeenCalledWith(356)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' })
    expect(aoRedimensionar).toHaveBeenCalledWith(324)
  })
})

