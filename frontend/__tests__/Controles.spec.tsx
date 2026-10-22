import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LocalTrackPublication, Room } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { Controles } from '../src/telas/Sala/Controles'
import { compartilhamentoFalso } from './apoio/compartilhamentoFalso'

/** A publicação do áudio da tela reduzida ao que a barra toca: mudo e a faixa. */
function audioDaTelaFalso(mudo: boolean): LocalTrackPublication {
  return {
    isMuted: mudo,
    track: { mediaStreamTrack: { id: 'som-da-tela' } as unknown as MediaStreamTrack },
  } as unknown as LocalTrackPublication
}

/** O participante local reduzido ao que a barra toca: o estado do microfone e a troca. */
function salaComDispositivos(parcial: { microfone?: boolean } = {}) {
  const local = {
    isMicrophoneEnabled: parcial.microfone ?? false,
    setMicrophoneEnabled: vi.fn(async () => {}),
  }
  return { local, sala: { localParticipant: local } as unknown as Room }
}

type Props = Parameters<typeof Controles>[0]

function montarBarra(parcial: Partial<Props> = {}) {
  const props: Props = {
    sala: null,
    compartilhamento: compartilhamentoFalso(),
    quemAssiste: [],
    chatAberto: false,
    naoLidasNoChat: 0,
    aoAlternarChat: vi.fn(),
    aoAbrirQualidade: vi.fn(),
    aoFalhar: vi.fn(),
    aoSair: vi.fn(),
    ...parcial,
  }
  return { ...props, ...render(<Controles {...props} />) }
}

const rotulos = () => screen.getAllByRole('button').map((botao) => botao.getAttribute('aria-label'))

describe('a barra flutuante', () => {
  it('sem transmitir: microfone, tela, chat e a saída — nada de câmera, trocar ou áudio da tela', () => {
    montarBarra()

    expect(rotulos()).toEqual(['Abrir microfone', 'Compartilhar tela', 'Chat', 'Sair da sala'])
  })

  it('no ar, o botão da tela vira "No ar" e abre o menu — trocar, som e qualidade saem da barra', async () => {
    const usuario = userEvent.setup()
    montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true }) })

    expect(rotulos()).toEqual([
      'Abrir microfone',
      'Sua tela está no ar — opções',
      'Ninguém assistindo ainda',
      'Chat',
      'Sair da sala',
    ])
    const botao = screen.getByRole('button', { name: 'Sua tela está no ar — opções' })
    expect(botao).toHaveAttribute('aria-haspopup', 'menu')
    expect(botao).toHaveAttribute('aria-expanded', 'false')

    await usuario.click(botao)

    expect(botao).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Sua tela no ar' })
    // Parar primeiro, na cor de perigo; depois o que se muda sem tirar a Tela do ar.
    const itens = [...menu.querySelectorAll('[role^="menuitem"]')]
    expect(itens.map((item) => item.textContent)).toEqual([
      'Parar de compartilhar',
      'Trocar tela',
      'Qualidade',
      'Som da telasem som',
    ])
    expect(itens[0]).toHaveAttribute('data-tom', 'perigo')
    expect(itens[0]).toHaveFocus()
  })

  it('cada botão escreve o que faz embaixo do ícone, e compartilhar vira "No ar"', () => {
    const legendas = () => screen.getAllByRole('button').map((botao) => botao.textContent)

    montarBarra()
    expect(legendas()).toEqual(['Microfone', 'Compartilhar', 'Chat', 'Sair'])

    montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true }) as Compartilhamento })
    expect(legendas().slice(4)).toEqual(['Microfone', 'No ar', 'Assistindo', 'Chat', 'Sair'])
  })

  it('clicar em compartilhar chama compartilhamento.alternar', async () => {
    const usuario = userEvent.setup()
    const { sala } = salaComDispositivos()
    const compartilhamento = compartilhamentoFalso() as Compartilhamento
    montarBarra({ sala, compartilhamento })

    await usuario.click(screen.getByRole('button', { name: 'Compartilhar tela' }))
    expect(compartilhamento.alternar).toHaveBeenCalledOnce()
  })

  describe('o menu de quem está no ar', () => {
    async function abrirMenu(parcial: Partial<Compartilhamento> = {}, props: Partial<Props> = {}) {
      const usuario = userEvent.setup()
      const compartilhamento = compartilhamentoFalso({ ativo: true, ...parcial }) as Compartilhamento
      const { aoAbrirQualidade } = montarBarra({ ...props, compartilhamento })
      await usuario.click(screen.getByRole('button', { name: 'Sua tela está no ar — opções' }))
      return { usuario, compartilhamento, aoAbrirQualidade }
    }

    it('parar chama alternar e fecha o menu', async () => {
      const { usuario, compartilhamento } = await abrirMenu()
      await usuario.click(screen.getByRole('menuitem', { name: 'Parar de compartilhar' }))
      expect(compartilhamento.alternar).toHaveBeenCalledOnce()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('trocar tela chama trocarDeTela — a Tela não sai do ar', async () => {
      const { usuario, compartilhamento } = await abrirMenu()
      await usuario.click(screen.getByRole('menuitem', { name: 'Trocar tela' }))
      expect(compartilhamento.trocarDeTela).toHaveBeenCalledOnce()
      expect(compartilhamento.alternar).not.toHaveBeenCalled()
    })

    it('qualidade abre a aba de qualidade', async () => {
      const { usuario, aoAbrirQualidade } = await abrirMenu()
      await usuario.click(screen.getByRole('menuitem', { name: 'Qualidade' }))
      expect(aoAbrirQualidade).toHaveBeenCalledOnce()
    })

    it('sem som na fonte, o item do som fica desabilitado e diz onde estava a escolha', async () => {
      await abrirMenu()
      const item = screen.getByRole('menuitemcheckbox', { name: /Som da tela/ })
      expect(item).toBeDisabled()
      expect(item).toHaveAttribute('title', expect.stringContaining('compartilhar áudio'))
    })

    it('com som no ar, o item é um interruptor marcado que cala sem fechar o menu', async () => {
      const { usuario, compartilhamento } = await abrirMenu({ audioDaTela: audioDaTelaFalso(false) })
      const item = screen.getByRole('menuitemcheckbox', { name: /Som da tela/ })
      expect(item).toHaveAttribute('aria-checked', 'true')
      expect(item).toHaveTextContent('ligado')

      await usuario.click(item)

      expect(compartilhamento.alternarAudioDaTela).toHaveBeenCalledOnce()
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('com som calado, o interruptor aparece desmarcado', async () => {
      await abrirMenu({ audioDaTela: audioDaTelaFalso(true) })
      const item = screen.getByRole('menuitemcheckbox', { name: /Som da tela/ })
      expect(item).toHaveAttribute('aria-checked', 'false')
      expect(item).toHaveTextContent('calado')
    })

    it('Esc fecha e devolve o foco ao botão; as setas andam pelos itens', async () => {
      const { usuario } = await abrirMenu()
      await usuario.keyboard('{ArrowDown}')
      expect(screen.getByRole('menuitem', { name: 'Trocar tela' })).toHaveFocus()
      await usuario.keyboard('{ArrowUp}{ArrowUp}')
      expect(screen.getByRole('menuitem', { name: 'Qualidade' })).toHaveFocus()

      await usuario.keyboard('{Escape}')

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sua tela está no ar — opções' })).toHaveFocus()
    })

    it('clicar fora fecha o menu', async () => {
      const { usuario } = await abrirMenu()
      await usuario.click(screen.getByRole('button', { name: 'Chat' }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('o microfone pede a troca ao SDK e se anuncia pelo estado', async () => {
    const usuario = userEvent.setup()
    const { local, sala } = salaComDispositivos({ microfone: true })
    montarBarra({ sala })

    expect(screen.getByRole('button', { name: 'Fechar microfone' })).toHaveAttribute('aria-pressed', 'true')
    await usuario.click(screen.getByRole('button', { name: 'Fechar microfone' }))
    expect(local.setMicrophoneEnabled).toHaveBeenCalledWith(false)
  })

  it('permissão negada vira frase explicando onde destravar; desistir no meio não vira frase', async () => {
    const usuario = userEvent.setup()
    const { local, sala } = salaComDispositivos()
    const aoFalhar = vi.fn()
    montarBarra({ sala, aoFalhar })

    local.setMicrophoneEnabled.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    )
    await usuario.click(screen.getByRole('button', { name: 'Abrir microfone' }))
    expect(aoFalhar).toHaveBeenLastCalledWith(
      'O navegador bloqueou o acesso ao microfone. Libere a permissão na barra de endereço e tente de novo.',
    )

    local.setMicrophoneEnabled.mockRejectedValueOnce(Object.assign(new Error('abortou'), { name: 'AbortError' }))
    await usuario.click(screen.getByRole('button', { name: 'Abrir microfone' }))
    expect(aoFalhar).toHaveBeenLastCalledWith(null)
  })

  it('o chat carrega as não lidas e se anuncia aberto', async () => {
    const usuario = userEvent.setup()
    const { aoAlternarChat } = montarBarra({ naoLidasNoChat: 4, chatAberto: true })

    const botao = screen.getByRole('button', { name: 'Chat' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('4 mensagens não lidas')).toHaveTextContent('4')

    await usuario.click(botao)
    expect(aoAlternarChat).toHaveBeenCalledOnce()
  })

  it('sem mensagem nova, nenhum contador', () => {
    montarBarra({ naoLidasNoChat: 0 })
    expect(screen.queryByLabelText(/não lidas/)).not.toBeInTheDocument()
  })

  it('compartilhar fica desabilitado enquanto o SDK está no meio da troca', () => {
    const { sala } = salaComDispositivos()
    montarBarra({ sala, compartilhamento: compartilhamentoFalso({ ocupado: true }) })
    expect(screen.getByRole('button', { name: 'Compartilhar tela' })).toBeDisabled()
  })

  it('antes de a sala existir, nada é clicável sem efeito', () => {
    montarBarra({ sala: null })

    expect(screen.getByRole('button', { name: 'Abrir microfone' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Compartilhar tela' })).toBeDisabled()
    // Chat e saída não dependem da sala: os dois funcionam desconectado.
    expect(screen.getByRole('button', { name: 'Chat' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sair da sala' })).toBeEnabled()
  })

  describe('quem está assistindo', () => {
    it('no ar, a barra conta quem assiste e diz os nomes no rótulo — que é a dica do mouse', () => {
      montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true }), quemAssiste: ['Bia', 'Carla'] })
      const botao = screen.getByRole('button', { name: '2 assistindo: Bia, Carla' })
      expect(botao).toHaveAttribute('title', '2 assistindo: Bia, Carla')
      expect(botao).toHaveTextContent('2')
    })

    it('tocar abre a lista com os nomes — no celular não há mouse para passar', async () => {
      const usuario = userEvent.setup()
      montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true }), quemAssiste: ['Bia'] })

      await usuario.click(screen.getByRole('button', { name: '1 assistindo: Bia' }))

      expect(screen.getByRole('group', { name: 'Quem está assistindo' })).toHaveTextContent('Bia')
    })

    it('sem ninguém, diz isso em vez de mostrar zero', () => {
      montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true }) })
      expect(screen.getByRole('button', { name: 'Ninguém assistindo ainda' })).not.toHaveTextContent('0')
    })

    it('sem compartilhar não há contador', () => {
      montarBarra({ quemAssiste: ['Bia'] })
      expect(screen.queryByRole('button', { name: /assistindo/ })).not.toBeInTheDocument()
    })
  })
})
