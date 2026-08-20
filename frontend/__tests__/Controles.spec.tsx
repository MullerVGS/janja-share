import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LocalTrackPublication } from 'livekit-client'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { Controles } from '../src/telas/Sala/Controles'
import { compartilhamentoFalso } from './apoio/compartilhamentoFalso'
import { habilitarWebAudio } from './apoio/navegador'

/** A publicação do áudio da tela reduzida ao que a barra toca: mudo, faixa e o par mute/unmute. */
function audioDaTelaFalso() {
  const publicacao = {
    isMuted: false,
    track: { mediaStreamTrack: { id: 'som-da-tela' } as unknown as MediaStreamTrack },
    mute: vi.fn(async () => {
      publicacao.isMuted = true
    }),
    unmute: vi.fn(async () => {
      publicacao.isMuted = false
    }),
  }
  return publicacao
}

/**
 * A barra com um compartilhamento de mentira. Alternar o áudio re-renderiza a árvore, como o
 * evento `TrackMuted` do `Room` faz na sala de verdade — o botão lê a publicação, não um estado
 * paralelo.
 */
function montarBarra(parcial: Partial<Compartilhamento> = {}) {
  function Cenario() {
    const [, reler] = useState(0)
    const base = compartilhamentoFalso(parcial)
    const compartilhamento: Compartilhamento = {
      ...base,
      alternarAudioDaTela: async () => {
        await base.alternarAudioDaTela()
        reler((n) => n + 1)
      },
    }
    return (
      <Controles
        sala={null}
        compartilhamento={compartilhamento}
        abaAberta={null}
        aoAlternarAba={() => {}}
        aoFalhar={() => {}}
        aoSair={() => {}}
      />
    )
  }
  return render(<Cenario />)
}

const DICA_SEM_AUDIO = "marque 'compartilhar áudio' no seletor ao iniciar"

describe('controles: áudio da tela', () => {
  it('o botão só existe enquanto a tela está no ar', () => {
    const { unmount } = montarBarra({ ativo: false })
    expect(screen.queryByRole('button', { name: /áudio da tela/i })).not.toBeInTheDocument()
    unmount()

    montarBarra({ ativo: true, audioDaTela: audioDaTelaFalso() as unknown as LocalTrackPublication })
    expect(screen.getByRole('button', { name: /áudio da tela/i })).toBeInTheDocument()
  })

  it('sem publicação de áudio o botão fica desabilitado e diz onde estava a escolha', () => {
    montarBarra({ ativo: true, audioDaTela: null })

    const botao = screen.getByRole('button', { name: /áudio da tela/i })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', DICA_SEM_AUDIO)
    expect(screen.queryByTitle('som saindo')).not.toBeInTheDocument()
  })

  it('clicar cala e devolve o som da tela, sem republicar nada', async () => {
    const usuario = userEvent.setup()
    const audio = audioDaTelaFalso()
    const alternarAudioDaTela = vi.fn(async () => {
      await (audio.isMuted ? audio.unmute() : audio.mute())
    })
    montarBarra({ ativo: true, audioDaTela: audio as unknown as LocalTrackPublication, alternarAudioDaTela })

    const botao = screen.getByRole('button', { name: /áudio da tela/i })
    expect(botao).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(botao)
    expect(audio.mute).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /áudio da tela/i })).toHaveAttribute('aria-pressed', 'false')

    await usuario.click(screen.getByRole('button', { name: /áudio da tela/i }))
    expect(audio.unmute).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /áudio da tela/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sem WebAudio no navegador, não há indicador de som saindo', () => {
    montarBarra({ ativo: true, audioDaTela: audioDaTelaFalso() as unknown as LocalTrackPublication })
    expect(screen.queryByTitle('som saindo')).not.toBeInTheDocument()
  })
})

describe('controles: indicador de som saindo', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }))
  afterEach(() => vi.useRealTimers())

  it('mede a faixa da tela ~10 vezes por segundo e escreve o nível direto no elemento', async () => {
    const webAudio = habilitarWebAudio()
    const audio = audioDaTelaFalso()
    const { unmount } = montarBarra({ ativo: true, audioDaTela: audio as unknown as LocalTrackPublication })

    const indicador = screen.getByTitle('som saindo')
    expect(indicador.style.getPropertyValue('--nivel')).toBe('0')
    expect(webAudio.faixas).toEqual([audio.track.mediaStreamTrack])

    webAudio.amplitude = 255
    await act(async () => vi.advanceTimersByTime(100))
    expect(indicador.style.getPropertyValue('--nivel')).toBe('1.00')

    webAudio.amplitude = 0
    await act(async () => vi.advanceTimersByTime(100))
    expect(indicador.style.getPropertyValue('--nivel')).toBe('0.00')

    unmount()
    expect(webAudio.abertos).toBe(0)
  })
})
