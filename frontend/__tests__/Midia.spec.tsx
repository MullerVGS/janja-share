import { render } from '@testing-library/react'
import { Track } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { volumeDe, type Volumes } from '../src/sala/volumes'
import { AudioDaSala } from '../src/telas/Sala/Midia'
import { assinar, participanteFalso, publicacaoFalsa, salaFalsa } from './apoio/salaFalsa'

function volumesFalsos(guardados: Volumes): ControleDeVolumes {
  return { volumeDe: (nome, tipo) => volumeDe(guardados, nome, tipo), definir: vi.fn(), alternarMudo: vi.fn() }
}

const EU = participanteFalso('eu-1', 'Ana')

describe('áudio da sala: o volume local aplicado nas faixas', () => {
  it('cada faixa remota nasce no volume guardado do seu nome e da sua fonte', () => {
    const voz = publicacaoFalsa(Track.Source.Microphone)
    const somDaTela = publicacaoFalsa(Track.Source.ScreenShareAudio)
    const bia = participanteFalso('bia-1', 'Bia', [voz, somDaTela, publicacaoFalsa(Track.Source.ScreenShare)])

    render(<AudioDaSala sala={salaFalsa(EU, [bia])} volumes={volumesFalsos({ Bia: { pessoa: 40, tela: 0 } })} />)

    expect(voz.track?.setVolume).toHaveBeenCalledWith(0.4)
    expect(somDaTela.track?.setVolume).toHaveBeenCalledWith(0)
  })

  it('quem nunca teve o volume mexido toca inteiro', () => {
    const voz = publicacaoFalsa(Track.Source.Microphone)
    const caio = participanteFalso('caio-1', 'Caio', [voz])

    render(<AudioDaSala sala={salaFalsa(EU, [caio])} volumes={volumesFalsos({})} />)

    expect(voz.track?.setVolume).toHaveBeenCalledWith(1)
  })

  it('a faixa que assina depois já entra no volume escolhido antes dela', () => {
    const voz = publicacaoFalsa(Track.Source.Microphone, { assinada: false })
    const bia = participanteFalso('bia-1', 'Bia', [voz])
    const sala = salaFalsa(EU, [bia])
    const volumes = volumesFalsos({ Bia: { pessoa: 25 } })
    const { rerender } = render(<AudioDaSala sala={sala} volumes={volumes} />)

    assinar(voz)
    rerender(<AudioDaSala sala={sala} volumes={volumes} />)

    expect(voz.track?.setVolume).toHaveBeenCalledWith(0.25)
    expect(voz.track?.attach).toHaveBeenCalledOnce()
  })

  it('mexer no volume reaplica na faixa que já está tocando', () => {
    const voz = publicacaoFalsa(Track.Source.Microphone)
    const bia = participanteFalso('bia-1', 'Bia', [voz])
    const sala = salaFalsa(EU, [bia])
    const { rerender } = render(<AudioDaSala sala={sala} volumes={volumesFalsos({ Bia: { pessoa: 80 } })} />)
    expect(voz.track?.setVolume).toHaveBeenLastCalledWith(0.8)

    rerender(<AudioDaSala sala={sala} volumes={volumesFalsos({ Bia: { pessoa: 10 } })} />)

    expect(voz.track?.setVolume).toHaveBeenLastCalledWith(0.1)
  })
})
