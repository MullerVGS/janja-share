import { Track } from 'livekit-client'
import { describe, expect, it } from 'vitest'
import { chavesDasTelasPublicadas, montarPalco } from '../src/sala/palco'
import { participanteFalso, publicacaoFalsa, salaFalsa } from './apoio/salaFalsa'

describe('chavesDasTelasPublicadas', () => {
  it('sem sala, nada', () => {
    expect(chavesDasTelasPublicadas(null)).toEqual([])
  })

  it('conta a tela muda, que o palco esconde — é o "antes" que impede o desmudar de virar tela nova', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [publicacaoFalsa(Track.Source.ScreenShare, { muda: true })])
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    const sala = salaFalsa(eu, [bia])

    expect(montarPalco(sala).telas.map((tela) => tela.chave)).toEqual(['tela:bia-x1y2'])
    expect(chavesDasTelasPublicadas(sala)).toEqual(['tela:ana-a1b2', 'tela:bia-x1y2'])
  })

  it('quem não publica tela não entra na conta', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [publicacaoFalsa(Track.Source.Camera)])
    expect(chavesDasTelasPublicadas(salaFalsa(eu))).toEqual([])
  })
})
