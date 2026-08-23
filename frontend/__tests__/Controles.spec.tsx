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

/** O participante local reduzido ao que a barra toca: o estado de cada dispositivo e a troca. */
function salaComDispositivos(parcial: { microfone?: boolean; camera?: boolean } = {}) {
  const local = {
    isMicrophoneEnabled: parcial.microfone ?? false,
    isCameraEnabled: parcial.camera ?? false,
    setMicrophoneEnabled: vi.fn(async () => {}),
    setCameraEnabled: vi.fn(async () => {}),
  }
  return { local, sala: { localParticipant: local } as unknown as Room }
}

type Props = Parameters<typeof Controles>[0]

function montarBarra(parcial: Partial<Props> = {}) {
  const props: Props = {
    sala: null,
    compartilhamento: compartilhamentoFalso(),
    chatAberto: false,
    naoLidasNoChat: 0,
    aoAlternarChat: vi.fn(),
    aoFalhar: vi.fn(),
    aoSair: vi.fn(),
    ...parcial,
  }
  return { ...props, ...render(<Controles {...props} />) }
}

const rotulos = () => screen.getAllByRole('button').map((botao) => botao.getAttribute('aria-label'))

describe('a barra flutuante', () => {
  it('sem transmitir: microfone, câmera, tela, chat e a saída — nada de trocar ou áudio da tela', () => {
    montarBarra()

    expect(rotulos()).toEqual(['Abrir microfone', 'Abrir câmera', 'Compartilhar tela', 'Chat', 'Sair da sala'])
  })

  it('transmitindo: trocar de tela e o áudio dela entram na barra, e trocar chama o compartilhamento', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = compartilhamentoFalso({ ativo: true }) as Compartilhamento
    montarBarra({ compartilhamento })

    expect(rotulos()).toEqual([
      'Abrir microfone',
      'Abrir câmera',
      'Parar de compartilhar a tela',
      'Trocar de tela',
      'Áudio da tela — marque "compartilhar áudio" no seletor',
      'Chat',
      'Sair da sala',
    ])

    await usuario.click(screen.getByRole('button', { name: 'Trocar de tela' }))
    expect(compartilhamento.trocarDeTela).toHaveBeenCalledOnce()
  })

  it('clicar em compartilhar/parar chama compartilhamento.alternar — o único lugar que aciona esse toggle', async () => {
    const usuario = userEvent.setup()
    const { sala } = salaComDispositivos()
    const compartilhamento = compartilhamentoFalso() as Compartilhamento
    montarBarra({ sala, compartilhamento })

    await usuario.click(screen.getByRole('button', { name: 'Compartilhar tela' }))
    expect(compartilhamento.alternar).toHaveBeenCalledOnce()
  })

  it('sem publicação de áudio, o botão da tela fica desabilitado e diz onde estava a escolha', () => {
    montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true }) })

    const botao = screen.getByRole('button', { name: 'Áudio da tela — marque "compartilhar áudio" no seletor' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-pressed', 'false')
  })

  it('com áudio no ar: "Calar o áudio da tela", ligado, e o clique chama alternarAudioDaTela', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = compartilhamentoFalso({
      ativo: true,
      audioDaTela: audioDaTelaFalso(false),
    }) as Compartilhamento
    montarBarra({ compartilhamento })

    const botao = screen.getByRole('button', { name: 'Calar o áudio da tela' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')
    expect(botao).toBeEnabled()

    await usuario.click(botao)
    expect(compartilhamento.alternarAudioDaTela).toHaveBeenCalledOnce()
  })

  it('com áudio mudo: "Devolver o áudio da tela", desligado', () => {
    montarBarra({ compartilhamento: compartilhamentoFalso({ ativo: true, audioDaTela: audioDaTelaFalso(true) }) })

    const botao = screen.getByRole('button', { name: 'Devolver o áudio da tela' })
    expect(botao).toHaveAttribute('aria-pressed', 'false')
    expect(botao).toBeEnabled()
  })

  it('microfone e câmera pedem a troca ao SDK e se anunciam pelo estado', async () => {
    const usuario = userEvent.setup()
    const { local, sala } = salaComDispositivos({ microfone: true })
    montarBarra({ sala })

    expect(screen.getByRole('button', { name: 'Fechar microfone' })).toHaveAttribute('aria-pressed', 'true')
    await usuario.click(screen.getByRole('button', { name: 'Fechar microfone' }))
    expect(local.setMicrophoneEnabled).toHaveBeenCalledWith(false)

    await usuario.click(screen.getByRole('button', { name: 'Abrir câmera' }))
    expect(local.setCameraEnabled).toHaveBeenCalledWith(true)
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

    local.setCameraEnabled.mockRejectedValueOnce(Object.assign(new Error('abortou'), { name: 'AbortError' }))
    await usuario.click(screen.getByRole('button', { name: 'Abrir câmera' }))
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
    expect(screen.getByRole('button', { name: 'Abrir câmera' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Compartilhar tela' })).toBeDisabled()
    // Chat e saída não dependem da sala: os dois funcionam desconectado.
    expect(screen.getByRole('button', { name: 'Chat' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sair da sala' })).toBeEnabled()
  })
})
