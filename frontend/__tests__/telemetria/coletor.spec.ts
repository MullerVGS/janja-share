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

  entraAssistindo(identidade: string, nome: string, receiver: ReturnType<typeof receiverFalso> | null = receiverFalso()) {
    this.remoteParticipants.set(identidade, {
      identity: identidade,
      name: nome,
      getTrackPublication: () => (receiver ? { track: { receiver } } : undefined),
    })
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
  const parar = criarColetor(sala as unknown as Room, (telemetria) => {
    atual = telemetria
    avisos += 1
  })
  return { parar, atual: () => atual, avisos: () => avisos }
}

async function passar(segundos: number) {
  await vi.advanceTimersByTimeAsync(segundos * 1000)
}

describe('coletor de telemetria', () => {
  beforeEach(() => vi.useFakeTimers())
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
})
