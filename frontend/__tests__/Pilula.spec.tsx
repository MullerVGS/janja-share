import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LocalTrackPublication } from 'livekit-client'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { Pilula } from '../src/telas/Sala/Pilula'
import { compartilhamentoFalso } from './apoio/compartilhamentoFalso'
import { habilitarPiP, habilitarTelaCheia } from './apoio/navegador'
import { peca, volumesFalsos } from './apoio/pecas'

type Props = Parameters<typeof Pilula>[0]

function montarPilula(parcial: Partial<Props> = {}) {
  const props: Props = {
    peca: peca('Bia', { ehTela: true }),
    volumes: volumesFalsos(),
    compartilhamento: compartilhamentoFalso(),
    zoom: { caber: vi.fn(), umPorUm: vi.fn() },
    telaCheia: { cheia: false, alternar: vi.fn() },
    pip: { emPiP: false, alternar: vi.fn() },
    ...parcial,
  }
  return { ...props, ...render(<Pilula {...props} />) }
}

/** A publicação do áudio da tela reduzida ao que a pílula toca: mudo, faixa e o par mute/unmute. */
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

const rotulos = () => screen.getAllByRole('button').map((botao) => botao.getAttribute('aria-label'))

describe('pílula: os botões saem do papel de quem vê', () => {
  it('na sua tela: parar, trocar, caber, 1:1 e o áudio da tela — e nada de volume do próprio som', () => {
    montarPilula({
      peca: peca('Ana', { ehTela: true, proprio: true }),
      compartilhamento: compartilhamentoFalso({
        ativo: true,
        audioDaTela: audioDaTelaFalso() as unknown as LocalTrackPublication,
      }),
    })

    expect(rotulos()).toEqual([
      'Calar o áudio da tela',
      'Trocar de tela',
      'Fazer a tela caber no quadro',
      'Ver em 1:1',
      'Parar de transmitir',
    ])
    expect(screen.queryByRole('slider', { name: /volume/i })).not.toBeInTheDocument()
  })

  it('na tela de outra pessoa: volume, caber, 1:1, janelinha e tela cheia — e nada de parar o que não é seu', () => {
    habilitarPiP()
    habilitarTelaCheia()
    montarPilula({ peca: peca('Bia', { ehTela: true }) })

    expect(rotulos()).toEqual([
      'Calar o som da tela de Bia',
      'Fazer a tela caber no quadro',
      'Ver em 1:1',
      'Ver na janelinha',
      'Ver em tela cheia',
    ])
    expect(screen.getByRole('slider', { name: 'Volume da tela de Bia' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /parar|trocar/i })).not.toBeInTheDocument()
  })

  it('na câmera de outra pessoa: só o volume', () => {
    habilitarPiP()
    habilitarTelaCheia()
    montarPilula({ peca: peca('Bia') })

    expect(rotulos()).toEqual(['Calar o som de Bia'])
    expect(screen.getByRole('slider', { name: 'Volume de Bia' })).toBeInTheDocument()
  })

  it('na sua própria câmera não há pílula nenhuma — nem volume do seu som, nem nada a apertar', () => {
    const { container } = montarPilula({ peca: peca('Ana', { proprio: true }) })
    expect(container).toBeEmptyDOMElement()
  })

  it('câmera alheia sem áudio publicado também não tem pílula', () => {
    const { container } = montarPilula({ peca: peca('Bia', { temAudio: false }) })
    expect(container).toBeEmptyDOMElement()
  })

  it('ninguém vê fixar: fixar é o clique', () => {
    habilitarTelaCheia()
    montarPilula({ peca: peca('Bia', { ehTela: true }) })
    expect(screen.queryByRole('button', { name: /fixar|foco/i })).not.toBeInTheDocument()
  })

  it('sem suporte do navegador, janelinha e tela cheia não aparecem', () => {
    montarPilula({ peca: peca('Bia', { ehTela: true }) })
    expect(screen.queryByRole('button', { name: /janelinha/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tela cheia/i })).not.toBeInTheDocument()
  })
})

describe('pílula: o que cada botão faz', () => {
  it('caber e 1:1 falam com o zoom daquela peça', async () => {
    const usuario = userEvent.setup()
    const { zoom } = montarPilula({ peca: peca('Bia', { ehTela: true }) })

    await usuario.click(screen.getByRole('button', { name: 'Fazer a tela caber no quadro' }))
    await usuario.click(screen.getByRole('button', { name: 'Ver em 1:1' }))

    expect(zoom.caber).toHaveBeenCalledOnce()
    expect(zoom.umPorUm).toHaveBeenCalledOnce()
  })

  it('parar de transmitir e trocar de tela chamam o compartilhamento', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = compartilhamentoFalso({ ativo: true })
    montarPilula({ peca: peca('Ana', { ehTela: true, proprio: true }), compartilhamento })

    await usuario.click(screen.getByRole('button', { name: 'Trocar de tela' }))
    await usuario.click(screen.getByRole('button', { name: 'Parar de transmitir' }))

    expect(compartilhamento.trocarDeTela).toHaveBeenCalledOnce()
    expect(compartilhamento.alternar).toHaveBeenCalledOnce()
  })

  it('a janelinha e a tela cheia se anunciam pelo estado em que estão', () => {
    habilitarPiP()
    habilitarTelaCheia()
    montarPilula({
      peca: peca('Bia', { ehTela: true }),
      telaCheia: { cheia: true, alternar: vi.fn() },
      pip: { emPiP: true, alternar: vi.fn() },
    })

    expect(screen.getByRole('button', { name: 'Trazer da janelinha' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('o mudo do quadro é o do nome e da fonte daquele quadro', async () => {
    const usuario = userEvent.setup()
    const volumes = volumesFalsos({ Bia: { tela: 0 } })
    montarPilula({ peca: peca('Bia', { ehTela: true }), volumes })

    const botao = screen.getByRole('button', { name: 'Devolver o som da tela de Bia' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(botao)
    expect(volumes.alternarMudo).toHaveBeenCalledWith('Bia', 'tela')
  })
})

const DICA_SEM_AUDIO = "marque 'compartilhar áudio' no seletor ao iniciar"

describe('pílula: o áudio da sua tela', () => {
  /** Alternar o áudio re-renderiza a árvore, como o `TrackMuted` do `Room` faz na sala de verdade. */
  function montarComAudio(audio: ReturnType<typeof audioDaTelaFalso> | null) {
    function Cenario() {
      const [, reler] = useState(0)
      const base = compartilhamentoFalso({
        ativo: true,
        audioDaTela: (audio ?? null) as unknown as LocalTrackPublication | null,
      })
      const compartilhamento: Compartilhamento = {
        ...base,
        alternarAudioDaTela: async () => {
          await (audio?.isMuted ? audio.unmute() : audio?.mute())
          reler((n) => n + 1)
        },
      }
      return (
        <Pilula
          peca={peca('Ana', { ehTela: true, proprio: true })}
          volumes={volumesFalsos()}
          compartilhamento={compartilhamento}
          zoom={{ caber: vi.fn(), umPorUm: vi.fn() }}
          telaCheia={{ cheia: false, alternar: vi.fn() }}
          pip={{ emPiP: false, alternar: vi.fn() }}
        />
      )
    }
    return render(<Cenario />)
  }

  it('cala e devolve o som da tela, sem republicar nada', async () => {
    const usuario = userEvent.setup()
    const audio = audioDaTelaFalso()
    montarComAudio(audio)

    await usuario.click(screen.getByRole('button', { name: 'Calar o áudio da tela' }))
    expect(audio.mute).toHaveBeenCalledOnce()

    await usuario.click(screen.getByRole('button', { name: 'Devolver o áudio da tela' }))
    expect(audio.unmute).toHaveBeenCalledOnce()
  })

  it('sem publicação de áudio o botão fica desabilitado e diz onde estava a escolha', () => {
    montarComAudio(null)

    const botao = screen.getByRole('button', { name: 'Áudio da tela' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', DICA_SEM_AUDIO)
    expect(screen.queryByTitle('som saindo')).not.toBeInTheDocument()
  })

  it('sem WebAudio no navegador, não há indicador de som saindo', () => {
    montarComAudio(audioDaTelaFalso())
    expect(screen.queryByTitle('som saindo')).not.toBeInTheDocument()
  })
})
