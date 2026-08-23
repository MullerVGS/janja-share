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
import { avaliarRecepcao, VIGIA_NOVO, type EstadoDaRecepcao, type Vigia } from '../sala/recepcao'
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
  /** O veredito do cão de guarda para cada tela assinada, pela identidade de quem a publica. */
  recepcao: ReadonlyMap<string, EstadoDaRecepcao>
}

export const TELEMETRIA_VAZIA: Telemetria = {
  emissor: [],
  espectadores: new Map(),
  recebidas: new Map(),
  recepcao: new Map(),
}

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
  const vigias = new Map<string, Vigia>()

  const publicar = (proximo: Telemetria) => {
    estado = proximo
    if (vivo) aoMudar(estado)
  }

  /**
   * Força o SDK a montar a assinatura de novo — o que republicar faz do lado de quem transmite,
   * mas sem depender dele. É o remédio do cão de guarda: um respiro antes de voltar, porque
   * `setSubscribed(true)` no mesmo tick é ignorado, o SDK ainda não processou o desligamento.
   */
  async function reassinar(identidade: string) {
    const publicacao = sala.remoteParticipants.get(identidade)?.getTrackPublication(Track.Source.ScreenShare)
    if (!publicacao || !('setSubscribed' in publicacao)) return
    publicacao.setSubscribed(false)
    setTimeout(() => publicacao.setSubscribed(true), 250)
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

            const vigia = vigias.get(identidade) ?? VIGIA_NOVO
            const passo = avaliarRecepcao(vigia, { emMs: leitura.amostra.emMs, kbps: leitura.amostra.kbps }, leitura.amostra.emMs)
            vigias.set(identidade, passo.vigia)
            if (passo.acao === 'reassinar') void reassinar(identidade)
          })
          .catch(() => {
            basesRecebidas.set(identidade, null)
            recebidas.set(identidade, anotar(historico, amostraVaziaDoEspectador(Date.now())))
          }),
      )
    }

    await Promise.all(leituras)
    for (const identidade of basesRecebidas.keys()) {
      if (recebidas.has(identidade)) continue
      basesRecebidas.delete(identidade)
      vigias.delete(identidade)
    }
    return recebidas
  }

  /** O estado do cão de guarda para cada tela ainda assinada — o que sobrevive à limpeza acima. */
  function recepcaoAtual(): ReadonlyMap<string, EstadoDaRecepcao> {
    const mapa = new Map<string, EstadoDaRecepcao>()
    for (const [identidade, vigia] of vigias) mapa.set(identidade, vigia.estado)
    return mapa
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
      publicar(
        ocioso
          ? TELEMETRIA_VAZIA
          : { emissor, recebidas, espectadores: espectadoresAinda(emissor.length > 0), recepcao: recepcaoAtual() },
      )
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
