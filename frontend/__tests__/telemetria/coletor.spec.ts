import { RoomEvent, type Room } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { amostraVaziaDoEspectador } from '../../src/telemetria/amostra'
import { criarColetor, TELEMETRIA_VAZIA, type Telemetria } from '../../src/telemetria/coletor'
import { empacotarRelato, TOPICO_DA_TELEMETRIA } from '../../src/telemetria/relato'

type Ouvinte = (...argumentos: unknown[]) => void

/** Um `RTCStatsReport` de mentira, com contadores que andam a cada leitura. */
function statsQueAndam(tipo: 'outbound-rtp' | 'inbound-rtp') {
  let leituras = 0
  return vi.fn(async () => {
    leituras += 1
    const base = { type: tipo, kind: 'video', timestamp: leituras * 1000, frameWidth: 1920, frameHeight: 1080 }
    const stat =
      tipo === 'outbound-rtp'
        ? { ...base, bytesSent: leituras * 125_000, framesEncoded: leituras * 30, qualityLimitationReason: 'none' }
        : { ...base, bytesReceived: leituras * 125_000, framesDecoded: leituras * 30, framesReceived: leituras * 30 }
    return new Map([['s', stat]])
  })
}

function senderFalso(ativo = true) {
  return { getStats: statsQueAndam('outbound-rtp'), getParameters: () => ({ encodings: [{ active: ativo }] }) }
}

function receiverFalso() {
  return { getStats: statsQueAndam('inbound-rtp') }
}

/**
 * Um receiver cujo bitrate nunca sai do zero — para simular a tela que nunca entrega nada, sem
 * o crescimento de `statsQueAndam`. O `timestamp` segue o relógio (falso) real, não uma
 * contagem de chamadas: uma leitura pode ficar de fora de uma batida (a janela do reassinar), e
 * o relógio da amostra precisa continuar batendo com o do teste mesmo assim.
 */
function receiverParado() {
  return {
    getStats: vi.fn(async () => new Map([
      ['s', { type: 'inbound-rtp', kind: 'video', timestamp: Date.now(), bytesReceived: 0, framesDecoded: 0, framesReceived: 0 }],
    ])),
  }
}

/** A publicação remota de uma tela: sobrevive ao respiro do `reassinar` — só `track` some e volta. */
function publicacaoRemotaFalsa(receiver: ReturnType<typeof receiverFalso> | null) {
  const publicacao: {
    trackSid: string
    track?: { receiver: ReturnType<typeof receiverFalso> }
    setSubscribed: ReturnType<typeof vi.fn>
  } = {
    trackSid: `tela-${Math.random().toString(36).slice(2)}`,
    track: receiver ? { receiver } : undefined,
    setSubscribed: vi.fn(),
  }
  publicacao.setSubscribed.mockImplementation((assinado: boolean) => {
    publicacao.track = assinado && receiver ? { receiver } : undefined
  })
  return publicacao
}

/** A sala reduzida ao que o coletor toca: publicações de tela, data channel e participantes. */
class SalaFalsa {
  ouvintes = new Map<string, Set<Ouvinte>>()
  publicados: { dados: Uint8Array; opcoes: Record<string, unknown> }[] = []
  minhaTela: { trackSid: string; track: { sender: ReturnType<typeof senderFalso> } } | undefined
  remoteParticipants = new Map<string, { identity: string; name: string; getTrackPublication(): unknown }>()

  localParticipant = {
    identity: 'eu',
    getTrackPublication: () => this.minhaTela,
    publishData: vi.fn(async (dados: Uint8Array, opcoes: Record<string, unknown>) => {
      this.publicados.push({ dados, opcoes })
    }),
  }

  on(evento: string, ouvinte: Ouvinte) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, new Set())
    this.ouvintes.get(evento)?.add(ouvinte)
    return this
  }

  off(evento: string, ouvinte: Ouvinte) {
    this.ouvintes.get(evento)?.delete(ouvinte)
    return this
  }

  publicarTela(sender = senderFalso()) {
    this.minhaTela = { trackSid: `t${Math.random()}`, track: { sender } }
  }

  /** `receiver: null` é "não publica tela nenhuma" — a publicação nem existe para o coletor. */
  entraAssistindo(identidade: string, nome: string, receiver: ReturnType<typeof receiverFalso> | null = receiverFalso()) {
    const publicacao = receiver === null ? undefined : publicacaoRemotaFalsa(receiver)
    this.remoteParticipants.set(identidade, { identity: identidade, name: nome, getTrackPublication: () => publicacao })
    return publicacao
  }

  /** Publica a tela, mas a faixa nunca chega a se materializar — o late joiner cuja assinatura não pegou. */
  entraAssistindoSemFaixa(identidade: string, nome: string) {
    const publicacao = publicacaoRemotaFalsa(null)
    this.remoteParticipants.set(identidade, { identity: identidade, name: nome, getTrackPublication: () => publicacao })
    return publicacao
  }

  receber(payload: Uint8Array, identidade: string, nome: string, topico = TOPICO_DA_TELEMETRIA) {
    for (const ouvinte of this.ouvintes.get(RoomEvent.DataReceived) ?? []) {
      ouvinte(payload, { identity: identidade, name: nome }, undefined, topico)
    }
  }

  quantosOuvintes() {
    return this.ouvintes.get(RoomEvent.DataReceived)?.size ?? 0
  }
}

function arrancar(sala: SalaFalsa) {
  let atual: Telemetria = TELEMETRIA_VAZIA
  let avisos = 0
  const coletor = criarColetor(sala as unknown as Room, (telemetria) => {
    atual = telemetria
    avisos += 1
  })
  return { ...coletor, atual: () => atual, avisos: () => avisos }
}

async function passar(segundos: number) {
  await vi.advanceTimersByTimeAsync(segundos * 1000)
}

describe('coletor de telemetria', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }))
  afterEach(() => vi.useRealTimers())

  it('com a tela no ar, anota uma amostra por segundo; a segunda já tem taxa', async () => {
    const sala = new SalaFalsa()
    sala.publicarTela()
    const { atual } = arrancar(sala)

    await passar(2)
    expect(atual().emissor).toHaveLength(2)
    expect(atual().emissor[0]?.kbps).toBeNull()
    expect(atual().emissor[1]?.kbps).toBe(1000)
    expect(atual().emissor[1]?.fpsCodificado).toBe(30)
  })

  it('sem tela no ar de ninguém fica quieto; publicar anota, parar de compartilhar zera uma vez', async () => {
    const sala = new SalaFalsa()
    const { atual, avisos } = arrancar(sala)

    await passar(2)
    expect(atual().emissor).toHaveLength(0)
    expect(avisos()).toBe(0)

    sala.publicarTela()
    await passar(3)
    expect(atual().emissor).toHaveLength(3)
    expect(avisos()).toBe(3)

    sala.minhaTela = undefined
    await passar(2)
    expect(atual().emissor).toHaveLength(0)
    expect(avisos()).toBe(4)
  })

  it('dynacast pausado chega na amostra como ativo=false', async () => {
    const sala = new SalaFalsa()
    sala.publicarTela(senderFalso(false))
    const { atual } = arrancar(sala)

    await passar(1)
    expect(atual().emissor[0]?.ativo).toBe(false)
  })

  it('getStats que rejeita vira amostra vazia — o gráfico segue, nada explode', async () => {
    const sala = new SalaFalsa()
    const sender = senderFalso()
    sender.getStats.mockRejectedValueOnce(new Error('sender fechando'))
    sala.publicarTela(sender)
    const { atual } = arrancar(sala)

    await passar(2)
    expect(atual().emissor).toHaveLength(2)
    expect(atual().emissor[0]?.largura).toBeNull()
    expect(atual().emissor[1]?.largura).toBe(1920)
  })

  it('assistindo uma tela, mede o que recebe e relata ao dono dela a cada 2 s, sem garantia de entrega', async () => {
    const sala = new SalaFalsa()
    sala.entraAssistindo('bia-1a2b3c', 'Bia')
    const { atual } = arrancar(sala)

    await passar(2)
    expect(atual().recebidas.get('bia-1a2b3c')).toHaveLength(2)
    expect(atual().recebidas.get('bia-1a2b3c')?.[1]?.fpsDecodificado).toBe(30)

    expect(sala.publicados).toHaveLength(1)
    expect(sala.publicados[0]?.opcoes).toEqual({
      topic: TOPICO_DA_TELEMETRIA,
      reliable: false,
      destinationIdentities: ['bia-1a2b3c'],
    })

    await passar(2)
    expect(sala.publicados).toHaveLength(2)
  })

  it('quem não publica tela não recebe relato; quem sai leva o histórico do que eu recebia', async () => {
    const sala = new SalaFalsa()
    sala.entraAssistindo('caio-9f9f9f', 'Caio', null)
    sala.entraAssistindo('bia-1a2b3c', 'Bia')
    const { atual } = arrancar(sala)

    await passar(2)
    expect(atual().recebidas.has('caio-9f9f9f')).toBe(false)
    expect(sala.publicados.map((p) => p.opcoes.destinationIdentities)).toEqual([['bia-1a2b3c']])

    sala.remoteParticipants.delete('bia-1a2b3c')
    await passar(1)
    expect(atual().recebidas.size).toBe(0)
  })

  it('o relato que chega no tópico da telemetria vira espectador, com nome e vistoEm', async () => {
    const sala = new SalaFalsa()
    sala.publicarTela()
    const { atual } = arrancar(sala)
    sala.entraAssistindo('bia-1a2b3c', 'Bia', null)

    const relato = { ...amostraVaziaDoEspectador(1), fpsDecodificado: 24, protocolo: 'udp' as const }
    sala.receber(empacotarRelato(relato), 'bia-1a2b3c', 'Bia')

    const espectador = atual().espectadores.get('bia-1a2b3c')
    expect(espectador?.nome).toBe('Bia')
    expect(espectador?.relato.fpsDecodificado).toBe(24)
    expect(espectador?.vistoEm).toBe(Date.now())
  })

  it('ignora o chat e payloads inválidos no canal', () => {
    const sala = new SalaFalsa()
    sala.publicarTela()
    const { atual } = arrancar(sala)

    sala.receber(new TextEncoder().encode('{"nome":"Bia","texto":"oi","ts":1}'), 'bia-1a2b3c', 'Bia', 'chat')
    sala.receber(new TextEncoder().encode('não é json'), 'bia-1a2b3c', 'Bia')

    expect(atual().espectadores.size).toBe(0)
  })

  it('espectador que saiu da sala some da lista no tick seguinte', async () => {
    const sala = new SalaFalsa()
    sala.publicarTela()
    sala.entraAssistindo('bia-1a2b3c', 'Bia', null)
    const { atual } = arrancar(sala)
    sala.receber(empacotarRelato(amostraVaziaDoEspectador(1)), 'bia-1a2b3c', 'Bia')
    expect(atual().espectadores.size).toBe(1)

    sala.remoteParticipants.delete('bia-1a2b3c')
    await passar(1)
    expect(atual().espectadores.size).toBe(0)
  })

  it('parar desliga o relógio e desassina o data channel', async () => {
    const sala = new SalaFalsa()
    sala.publicarTela()
    const { parar, atual } = arrancar(sala)
    await passar(1)
    expect(sala.quantosOuvintes()).toBe(1)

    parar()
    await passar(3)
    expect(sala.quantosOuvintes()).toBe(0)
    expect(atual().emissor).toHaveLength(1)
  })

  describe('recepção: o vigia sobrevive à fiação do reassinar', () => {
    it('publicação sem faixa nenhuma alimenta o vigia com null e dispara setSubscribed(false), depois (true)', async () => {
      const sala = new SalaFalsa()
      const publicacao = sala.entraAssistindoSemFaixa('bia-1a2b3c', 'Bia')
      arrancar(sala)

      await passar(6)

      expect(publicacao.setSubscribed).toHaveBeenNthCalledWith(1, false)
      expect(publicacao.setSubscribed).toHaveBeenNthCalledWith(2, true)
    })

    it('o vigia sobrevive à janela em que o próprio reassinar esvazia `track` — as tentativas não voltam a zero', async () => {
      const sala = new SalaFalsa()
      const receiver = receiverParado()
      // Religar não é instantâneo: o SDK de verdade demora mais que os 250 ms do `reassinar`
      // para a faixa voltar a existir — o suficiente para a batida seguinte (1 Hz) cair no meio
      // do caminho e observar `track` ainda vazio. É exatamente essa janela que o bug apagava.
      const publicacao: { trackSid: string; track?: { receiver: typeof receiver }; setSubscribed: ReturnType<typeof vi.fn> } = {
        trackSid: 'tela-fixa',
        track: { receiver },
        setSubscribed: vi.fn(),
      }
      publicacao.setSubscribed.mockImplementation((assinado: boolean) => {
        if (!assinado) {
          publicacao.track = undefined
          return
        }
        setTimeout(() => {
          publicacao.track = { receiver }
        }, 1500)
      })
      sala.remoteParticipants.set('bia-1a2b3c', { identity: 'bia-1a2b3c', name: 'Bia', getTrackPublication: () => publicacao })
      const { atual } = arrancar(sala)

      // Sem a correção, cada janela sem `track` apaga o vigia e zera as tentativas — e
      // TENTATIVAS_MAXIMAS nunca seria alcançado, então 'desistiu' nunca apareceria.
      await passar(30)

      expect(atual().recepcao.get('bia-1a2b3c')).toBe('desistiu')
    })

    it('tela que entregou bytes e depois fica com bitrate zerado não dispara reassinatura — está parada de verdade, não é o bug', async () => {
      const sala = new SalaFalsa()
      const receiver = receiverFalso()
      const publicacao = sala.entraAssistindo('bia-1a2b3c', 'Bia', receiver)
      const { atual } = arrancar(sala)

      await passar(2)
      expect(atual().recepcao.get('bia-1a2b3c')).toBe('ok')

      // A mesma faixa (mesmo trackSid) passa a entregar bitrate zerado — os bytes acumulados
      // congelam no valor que `statsQueAndam` já tinha alcançado na 2ª leitura (2 × 125 000).
      receiver.getStats.mockImplementation(async () => new Map([
        [
          's',
          {
            type: 'inbound-rtp' as const,
            kind: 'video',
            timestamp: Date.now(),
            bytesReceived: 250_000,
            framesDecoded: 60,
            framesReceived: 60,
            frameWidth: 1920,
            frameHeight: 1080,
          },
        ],
      ]))

      await passar(30)

      expect(atual().recepcao.get('bia-1a2b3c')).toBe('ok')
      expect(publicacao?.setSubscribed).not.toHaveBeenCalled()
    })

    /**
     * `'desistiu'` é absorvente: sem esta porta, o produto final do cão de guarda seria uma
     * mensagem mandando pedir para o outro reiniciar a transmissão — a dependência que a §4 do
     * desenho abre dizendo que ia eliminar.
     */
    it('rearmar devolve o vigia de uma tela que desistiu ao começo — e uma reassinatura nova sai', async () => {
      const sala = new SalaFalsa()
      const publicacao = sala.entraAssistindoSemFaixa('bia-1a2b3c', 'Bia')
      const { atual, rearmar } = arrancar(sala)

      await passar(30)
      expect(atual().recepcao.get('bia-1a2b3c')).toBe('desistiu')
      const tentativasAntes = publicacao.setSubscribed.mock.calls.length

      rearmar('bia-1a2b3c')

      // O aviso sai na hora do clique: quem apertou não espera a batida seguinte para ver efeito.
      expect(atual().recepcao.get('bia-1a2b3c')).toBe('parada')
      await passar(6)
      expect(publicacao.setSubscribed.mock.calls.length).toBeGreaterThan(tentativasAntes)
      expect(atual().recepcao.get('bia-1a2b3c')).toBe('retomando')
    })

    it('rearmar quem não é tela assinada nenhuma não inventa vigia', async () => {
      const sala = new SalaFalsa()
      const { atual, rearmar } = arrancar(sala)
      await passar(1)

      rearmar('ninguem-aqui')

      expect(atual().recepcao.has('ninguem-aqui')).toBe(false)
    })

    it('participante que sai tem o vigia descartado — a próxima leitura não acha rastro de quem não está mais na sala', async () => {
      const sala = new SalaFalsa()
      sala.entraAssistindo('bia-1a2b3c', 'Bia')
      const { atual } = arrancar(sala)

      await passar(1)
      expect(atual().recepcao.has('bia-1a2b3c')).toBe(true)

      sala.remoteParticipants.delete('bia-1a2b3c')
      await passar(1)
      expect(atual().recepcao.has('bia-1a2b3c')).toBe(false)
    })
  })
})
