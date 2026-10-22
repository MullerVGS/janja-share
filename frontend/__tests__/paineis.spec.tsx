import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionState } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { estadoDaConexao, PRESO_SEM_ROTA_MS } from '../src/sala/estadoDaConexao'
import { PainelDaPessoa } from '../src/telas/Casca/PainelDaPessoa'
import { PainelDeVoz } from '../src/telas/Casca/PainelDeVoz'
import { DialogoConvite } from '../src/telas/Sala/DialogoConvite'

function painelDeVoz(parcial: Partial<Parameters<typeof PainelDeVoz>[0]> = {}) {
  const props = {
    estado: estadoDaConexao(ConnectionState.Connected, undefined, 0),
    nomeDaSala: 'Eclipse',
    aoMostrarSala: vi.fn(),
    aoSair: vi.fn(),
    compartilhando: false,
    aoAlternarTela: vi.fn(),
    telaOcupada: false,
    aoRecarregarMidia: vi.fn(),
    aoConvidar: vi.fn(),
    aoVerMetricas: vi.fn(),
    conectada: true,
    ...parcial,
  }
  render(<PainelDeVoz {...props} />)
  return props
}

describe('o painel de voz conectada', () => {
  it('diz o estado em cor e o nome da sala; o nome leva de volta à chamada', async () => {
    const usuario = userEvent.setup()
    const { aoMostrarSala } = painelDeVoz()

    expect(screen.getByRole('button', { name: /Voz conectada/ })).toHaveAttribute('data-tom', 'bom')
    await usuario.click(screen.getByRole('button', { name: 'Eclipse / janja-share' }))
    expect(aoMostrarSala).toHaveBeenCalledOnce()
  })

  it('preso sem conectar, o clique explica que a rede parece bloquear a mídia', async () => {
    const usuario = userEvent.setup()
    painelDeVoz({ estado: estadoDaConexao(ConnectionState.Connecting, undefined, PRESO_SEM_ROTA_MS), conectada: false })

    await usuario.click(screen.getByRole('button', { name: /Sem rota/ }))
    expect(screen.getByRole('group', { name: 'Estado da conexão' })).toHaveTextContent(/Sua rede parece bloquear a mídia/)
    expect(screen.getByRole('button', { name: 'Compartilhar tela' })).toBeDisabled()
    for (const botao of screen.getAllByRole('button', { name: 'Recarregar mídia' })) expect(botao).toBeDisabled()
  })

  it('desligar, compartilhar, recarregar e convidar chamam quem cuida', async () => {
    const usuario = userEvent.setup()
    const props = painelDeVoz()
    await usuario.click(screen.getByRole('button', { name: 'Sair da sala' }))
    await usuario.click(screen.getByRole('button', { name: 'Compartilhar tela' }))
    await usuario.click(screen.getByRole('button', { name: 'Recarregar mídia' }))
    await usuario.click(screen.getByRole('button', { name: 'Convidar' }))
    expect(props.aoSair).toHaveBeenCalledOnce()
    expect(props.aoAlternarTela).toHaveBeenCalledOnce()
    expect(props.aoRecarregarMidia).toHaveBeenCalledOnce()
    expect(props.aoConvidar).toHaveBeenCalledOnce()
  })
})

describe('o painel da pessoa', () => {
  it('o microfone fechado fica em vermelho e o aviso de silenciado aparece junto', () => {
    render(
      <PainelDaPessoa
        nome="Ana"
        aoMudarNome={vi.fn()}
        estado="Na sala"
        microfone={{ ligado: false, ocupado: false, alternar: vi.fn(), aviso: 'Você está silenciado(a)!' }}
        surdo={{ ligado: false, alternar: vi.fn() }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Abrir microfone' })).toHaveAttribute('data-fechado')
    expect(screen.getByRole('status')).toHaveTextContent('Você está silenciado(a)!')
  })

  it('ensurdecer se anuncia e risca os fones', async () => {
    const usuario = userEvent.setup()
    const alternar = vi.fn()
    const { rerender } = render(
      <PainelDaPessoa nome="Ana" aoMudarNome={vi.fn()} estado="Na sala" microfone={null} surdo={{ ligado: false, alternar }} />,
    )
    await usuario.click(screen.getByRole('button', { name: 'Ensurdecer' }))
    expect(alternar).toHaveBeenCalledOnce()

    rerender(<PainelDaPessoa nome="Ana" aoMudarNome={vi.fn()} estado="Na sala" microfone={null} surdo={{ ligado: true, alternar }} />)
    expect(screen.getByRole('button', { name: 'Voltar a ouvir a sala' })).toHaveAttribute('data-riscado')
  })
})

describe('o convite', () => {
  it('mostra o link e copia o link inteiro', async () => {
    const usuario = userEvent.setup()
    const escrever = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<DialogoConvite aberto nomeDaSala="Eclipse" fixa link="http://x/sala/eclipse?k=a.b" oculto={false} aoFechar={vi.fn()} />)

    expect(screen.getByLabelText('Link da sala')).toHaveValue('http://x/sala/eclipse?k=a.b')
    await usuario.click(screen.getByRole('button', { name: 'Copiar convite' }))
    expect(escrever).toHaveBeenCalledWith('http://x/sala/eclipse?k=a.b')
    expect(screen.getByRole('button', { name: 'Copiar convite' })).toHaveTextContent('Copiado')
  })

  it('oculto (sala privada com a minha Tela no ar), o campo esconde o link e o Copiar continua', async () => {
    const usuario = userEvent.setup()
    const escrever = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<DialogoConvite aberto nomeDaSala="Cofre" fixa link="http://x/sala/cofre-c0ffee?k=a.b" oculto aoFechar={vi.fn()} />)

    expect(screen.getByLabelText('Link da sala')).not.toHaveValue(expect.stringContaining('c0ffee'))
    expect(screen.getByLabelText('Link da sala')).toHaveValue('Oculto enquanto sua tela está no ar; use o Copiar')
    await usuario.click(screen.getByRole('button', { name: 'Copiar convite' }))
    expect(escrever).toHaveBeenCalledWith('http://x/sala/cofre-c0ffee?k=a.b')
  })
})
