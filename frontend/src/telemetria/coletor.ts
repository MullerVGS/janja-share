import {
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteTrack,
  type Room,
} from 'livekit-client'
import {
  amostraVaziaDoEmissor,
  amostraVaziaDoEspectador,
  lerAmostraDoEmissor,
  lerAmostraDoEspectador,
  type AmostraDoEmissor,
  type AmostraDoEspectador,
  type BaseDoEmissor,
  type BaseDoEspectador,
} from './amostra'
import { anotar, ultima, type Historico } from './historico'
import {
  desempacotarRelato,
  empacotarRelato,
  INTERVALO_DO_RELATO_MS,
  TOPICO_DA_TELEMETRIA,
  type Espectador,
} from './relato'

const INTERVALO_MS = 1000

export interface Telemetria {
  /** A própria transmissão; vazio quando não há tela publicada. */
  emissor: Historico<AmostraDoEmissor>
  /** Quem assiste a minha tela, pelo último relato de cada pessoa. */
  espectadores: ReadonlyMap<string, Espectador>
  /** O que eu recebo de cada tela assinada, pela identidade de quem a publica. */
  recebidas: ReadonlyMap<string, Historico<AmostraDoEspectador>>
}

export const TELEMETRIA_VAZIA: Telemetria = { emissor: [], espectadores: new Map(), recebidas: new Map() }

/**
 * O relógio único da telemetria: a cada segundo lê o sender da tela própria e o receiver de
 * cada tela assinada, anota as amostras e, a cada dois segundos, relata ao dono de cada tela
 * o que está chegando. Também escuta o data channel pelos relatos dos outros.
 *
 * Tudo é lido do `Room` na hora da leitura — publicar e despublicar não precisam avisar
 * ninguém. Devolve a função que para o relógio.
 */
export function criarColetor(sala: Room, aoMudar: (telemetria: Telemetria) => void): () => void {
  let estado = TELEMETRIA_VAZIA
  let vivo = true
  let lendo = false
  let batidas = 0

  let sidDoEmissor: string | null = null
  let baseDoEmissor: BaseDoEmissor | null = null
  const basesRecebidas = new Map<string, BaseDoEspectador | null>()

  const publicar = (proximo: Telemetria) => {
    estado = proximo
    if (vivo) aoMudar(estado)
  }

  async function lerEmissor(): Promise<Historico<AmostraDoEmissor>> {
    const publicacao = sala.localParticipant.getTrackPublication(Track.Source.ScreenShare) as
      | LocalTrackPublication
      | undefined
    const sender = publicacao?.track?.sender
    if (!publicacao || !sender) {
      sidDoEmissor = null
      baseDoEmissor = null
      return []
    }

    let historico = estado.emissor
    if (publicacao.trackSid !== sidDoEmissor) {
      sidDoEmissor = publicacao.trackSid
      baseDoEmissor = null
      historico = []
    }

    let ativo = true
    try {
      ativo = sender.getParameters().encodings?.[0]?.active !== false
    } catch {
      // Sender fechando: a leitura do encoding não importa mais.
    }

    try {
      const leitura = lerAmostraDoEmissor(await sender.getStats(), baseDoEmissor, ativo)
      baseDoEmissor = leitura.base
      return anotar(historico, leitura.amostra)
    } catch {
      baseDoEmissor = null
      return anotar(historico, amostraVaziaDoEmissor(Date.now(), ativo))
    }
  }

  async function lerRecebidas(): Promise<Map<string, Historico<AmostraDoEspectador>>> {
    const recebidas = new Map<string, Historico<AmostraDoEspectador>>()
    const leituras: Promise<void>[] = []

    for (const participante of sala.remoteParticipants.values()) {
      const receiver = (participante.getTrackPublication(Track.Source.ScreenShare)?.track as RemoteTrack | undefined)
        ?.receiver
      if (!receiver) continue
      const identidade = participante.identity
      const historico = estado.recebidas.get(identidade) ?? []
      leituras.push(
        receiver
          .getStats()
          .then((relatorio) => {
            const leitura = lerAmostraDoEspectador(relatorio, basesRecebidas.get(identidade) ?? null)
            basesRecebidas.set(identidade, leitura.base)
            recebidas.set(identidade, anotar(historico, leitura.amostra))
          })
          .catch(() => {
            basesRecebidas.set(identidade, null)
            recebidas.set(identidade, anotar(historico, amostraVaziaDoEspectador(Date.now())))
          }),
      )
    }

    await Promise.all(leituras)
    for (const identidade of basesRecebidas.keys()) if (!recebidas.has(identidade)) basesRecebidas.delete(identidade)
    return recebidas
  }

  function relatar(recebidas: ReadonlyMap<string, Historico<AmostraDoEspectador>>) {
    for (const [identidade, historico] of recebidas) {
      const amostra = ultima(historico)
      if (!amostra) continue
      sala.localParticipant
        .publishData(empacotarRelato(amostra), {
          topic: TOPICO_DA_TELEMETRIA,
          reliable: false,
          destinationIdentities: [identidade],
        })
        .catch(() => {
          // Sem garantia de entrega por definição: o próximo relato substitui este.
        })
    }
  }

  /** Quem saiu da sala não está mais assistindo; sem tela no ar, ninguém está. */
  function espectadoresAinda(publicando: boolean): ReadonlyMap<string, Espectador> {
    const vivos = new Map<string, Espectador>()
    if (!publicando) return vivos
    for (const [identidade, espectador] of estado.espectadores) {
      if (sala.remoteParticipants.has(identidade)) vivos.set(identidade, espectador)
    }
    return vivos
  }

  async function bater() {
    if (lendo) return
    lendo = true
    batidas += 1
    try {
      const [emissor, recebidas] = await Promise.all([lerEmissor(), lerRecebidas()])
      if (!vivo) return
      if (batidas % (INTERVALO_DO_RELATO_MS / INTERVALO_MS) === 0) relatar(recebidas)
      // Sem tela no ar de ninguém não há o que dizer — e não há por que redesenhar a sala a 1 Hz.
      const ocioso = emissor.length === 0 && recebidas.size === 0
      if (ocioso && estado === TELEMETRIA_VAZIA) return
      publicar(ocioso ? TELEMETRIA_VAZIA : { emissor, recebidas, espectadores: espectadoresAinda(emissor.length > 0) })
    } finally {
      lendo = false
    }
  }

  const receber = (dados: Uint8Array, remetente?: { identity: string; name?: string }, _tipo?: unknown, topico?: string) => {
    if (topico !== TOPICO_DA_TELEMETRIA || !remetente) return
    const relato = desempacotarRelato(dados)
    if (!relato) return
    const espectadores = new Map(estado.espectadores)
    espectadores.set(remetente.identity, {
      identidade: remetente.identity,
      nome: remetente.name?.trim() || remetente.identity,
      relato,
      vistoEm: Date.now(),
    })
    publicar({ ...estado, espectadores })
  }

  sala.on(RoomEvent.DataReceived, receber)
  const relogio = setInterval(() => void bater(), INTERVALO_MS)

  return () => {
    vivo = false
    clearInterval(relogio)
    sala.off(RoomEvent.DataReceived, receber)
  }
}
