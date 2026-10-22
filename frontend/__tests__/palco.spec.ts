import { ConnectionQuality, ConnectionState, Track } from 'livekit-client'
import { describe, expect, it } from 'vitest'
import { chavesDasTelasPublicadas, estadoDoQuadro, montarPalco, pecaEncerrada, type Peca } from '../src/sala/palco'
import { participanteFalso, publicacaoFalsa, salaFalsa } from './apoio/salaFalsa'

describe('chavesDasTelasPublicadas', () => {
  it('sem sala, nada', () => {
    expect(chavesDasTelasPublicadas(null)).toEqual([])
  })

  it('conta a tela muda — é o "antes" que impede o desmudar de virar tela nova', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [publicacaoFalsa(Track.Source.ScreenShare, { muda: true })])
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    const sala = salaFalsa(eu, [bia])

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

describe('montarPalco: pessoa nunca tem imagem', () => {
  it('uma câmera publicada não vira imagem de pessoa — o palco não tem quadro de pessoa', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [publicacaoFalsa(Track.Source.Camera)])
    const palco = montarPalco(salaFalsa(eu))

    expect(palco.telas).toEqual([])
    expect(palco.pessoas.map((pessoa) => pessoa.chave)).toEqual(['pessoa:ana-a1b2'])
    expect(palco.pessoas[0]?.publicacao).toBeUndefined()
  })
})

describe('montarPalco: a tela pausada continua sendo quadro', () => {
  it('a tela muda entra no palco marcada como pausada, em vez de sumir', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [])
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare, { muda: true })])
    const palco = montarPalco(salaFalsa(eu, [bia]))

    expect(palco.telas.map((tela) => [tela.chave, tela.pausada])).toEqual([['tela:bia-x1y2', true]])
  })

  it('a peça leva a conexão do dono, como o SFU a mede', () => {
    const eu = participanteFalso('ana-a1b2', 'Ana', [])
    const bia = { ...participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)]), connectionQuality: ConnectionQuality.Poor }
    expect(montarPalco(salaFalsa(eu, [bia])).telas[0]?.qualidade).toBe(ConnectionQuality.Poor)
  })
})

describe('estadoDoQuadro', () => {
  const CONECTADA = ConnectionState.Connected
  const tela = (parcial: Partial<Peca> = {}): Peca => ({
    chave: 'tela:bia', identidade: 'bia', nome: 'Bia', ehTela: true, proprio: false,
    microfoneLigado: false, falando: false, temAudio: false, ...parcial,
  })

  it('sem nada a dizer, está ao vivo', () => {
    expect(estadoDoQuadro(tela({ recepcao: 'ok' }), CONECTADA)).toBe('aoVivo')
  })

  it.each([
    ['retomando', 'chegando'],
    ['desistiu', 'nuncaChegou'],
    ['congelada', 'congelada'],
  ] as const)('o cão de guarda em %s vira %s', (recepcao, estado) => {
    expect(estadoDoQuadro(tela({ recepcao }), CONECTADA)).toBe(estado)
  })

  it('pausada explica a imagem parada antes do cão de guarda', () => {
    expect(estadoDoQuadro(tela({ pausada: true, recepcao: 'congelada' }), CONECTADA)).toBe('pausada')
  })

  it('a conexão do dono caída explica antes de pausada', () => {
    expect(estadoDoQuadro(tela({ pausada: true, qualidade: ConnectionQuality.Lost }), CONECTADA)).toBe('donoReconectando')
  })

  it('a própria conexão caída explica tudo, inclusive a tela que parece ter terminado', () => {
    for (const estado of [ConnectionState.Reconnecting, ConnectionState.SignalReconnecting, ConnectionState.Disconnected]) {
      expect(estadoDoQuadro(pecaEncerrada(tela()), estado)).toBe('voceReconectando')
    }
  })

  it('a peça encerrada é a mesma chave, sem imagem nem som, dizendo que terminou', () => {
    const encerrada = pecaEncerrada(tela({ publicacao: {} as Peca['publicacao'], temAudio: true, recepcao: 'congelada' }))
    expect(encerrada).toMatchObject({ chave: 'tela:bia', publicacao: undefined, temAudio: false, encerrada: true })
    expect(estadoDoQuadro(encerrada, CONECTADA)).toBe('terminou')
  })

  it('a própria tela não mostra a conexão do dono como alheia', () => {
    expect(estadoDoQuadro(tela({ proprio: true, qualidade: ConnectionQuality.Lost }), CONECTADA)).toBe('aoVivo')
  })
})
