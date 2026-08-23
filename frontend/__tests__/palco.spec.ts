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

describe('montarPalco: recepção da tela', () => {
  it('sem o mapa, a tela alheia não ganha veredito nenhum', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [])
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    const sala = salaFalsa(eu, [bia])

    expect(montarPalco(sala).telas[0]?.recepcao).toBeUndefined()
  })

  it('a tela alheia leva o veredito do mapa, pela identidade de quem publica', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [])
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    const sala = salaFalsa(eu, [bia])
    const recepcao = new Map([['bia-x1y2', 'retomando' as const]])

    expect(montarPalco(sala, recepcao).telas[0]?.recepcao).toBe('retomando')
  })

  it('a própria tela nunca ganha o aviso — não há assinatura de quem transmite para si mesmo', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [publicacaoFalsa(Track.Source.ScreenShare)])
    const sala = salaFalsa(eu)
    // Um mapa "malicioso" com a própria identidade não deveria nem existir na prática — o
    // coletor só assina tela alheia — mas o teste garante que `montarPalco` blinda o caso.
    const recepcao = new Map([['ana-a1b2', 'desistiu' as const]])

    expect(montarPalco(sala, recepcao).telas[0]?.recepcao).toBeUndefined()
  })
})
