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
  // A faixa que cada vigia está olhando. `reassinar` esvazia `publicacao.track` por uma janela
  // do tamanho do intervalo entre batidas — sem isto, uma batida caindo nessa janela pareceria
  // "a tela sumiu" e apagaria o vigia junto, resetando as tentativas a cada ciclo (nunca desiste)
  // e reabrindo a vigilância de uma tela já confirmada em `'ok'` (o falso positivo de volta).
  const sidsRecebidos = new Map<string, string>()

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

  /** Avalia a leitura mais recente daquela tela e dispara a reassinatura quando for a vez. */
  function avaliarEAgir(identidade: string, amostra: AmostraDoEspectador) {
    const vigia = vigias.get(identidade) ?? VIGIA_NOVO
    const passo = avaliarRecepcao(vigia, { emMs: amostra.emMs, kbps: amostra.kbps }, amostra.emMs)
    vigias.set(identidade, passo.vigia)
    if (passo.acao === 'reassinar') void reassinar(identidade)
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
    const vistos = new Set<string>()

    for (const participante of sala.remoteParticipants.values()) {
      // A publicação é o que existe de verdade; o `track` (e o `receiver` que ele expõe) pode
      // estar temporariamente ausente — assinatura que ainda não se materializou, ou o respiro
      // do `reassinar`. Chavear por publicação, não por `receiver`, é o que faz o vigia e as
      // bases sobreviverem a essa ausência em vez de serem apagados a cada batida sem faixa.
      const publicacao = participante.getTrackPublication(Track.Source.ScreenShare)
      if (!publicacao) continue
      const identidade = participante.identity
      vistos.add(identidade)

      // Faixa nova — primeira vez que esta tela é vista, ou a pessoa trocou de tela: os
      // contadores e o vigia da faixa anterior não valem para esta. Sem isto, uma troca de
      // tela herda o vigia em `'ok'` da faixa antiga (nasce sem rede) e o primeiro delta de
      // bytes contra a base do receiver antigo sai negativo.
      if (sidsRecebidos.get(identidade) !== publicacao.trackSid) {
        sidsRecebidos.set(identidade, publicacao.trackSid)
        basesRecebidas.delete(identidade)
        vigias.set(identidade, VIGIA_NOVO)
      }

      const historico = estado.recebidas.get(identidade) ?? []
      const receiver = (publicacao.track as RemoteTrack | undefined)?.receiver

      if (!receiver) {
        // Publicação sem faixa: a assinatura nunca chegou a se materializar, ou está na janela
        // do `reassinar`. É o mesmo sintoma de "nada chegando" — alimentar com `null` em vez de
        // pular a rodada é o que evita a tela que nunca ganha faixa ficar com `recepcao:
        // undefined`, sem aviso e sem tentativa, para sempre.
        const amostra = amostraVaziaDoEspectador(Date.now())
        recebidas.set(identidade, anotar(historico, amostra))
        avaliarEAgir(identidade, amostra)
        continue
      }

      leituras.push(
        receiver
          .getStats()
          .then((relatorio) => {
            const leitura = lerAmostraDoEspectador(relatorio, basesRecebidas.get(identidade) ?? null)
            basesRecebidas.set(identidade, leitura.base)
            recebidas.set(identidade, anotar(historico, leitura.amostra))
            avaliarEAgir(identidade, leitura.amostra)
          })
          .catch(() => {
            basesRecebidas.set(identidade, null)
            const amostra = amostraVaziaDoEspectador(Date.now())
            recebidas.set(identidade, anotar(historico, amostra))
            avaliarEAgir(identidade, amostra)
          }),
      )
    }

    await Promise.all(leituras)
    // Só sai daqui quem realmente não tem mais publicação de tela — não quem só ficou uma
    // batida sem `receiver`, que já foi tratado acima e continua em `vistos`.
    for (const identidade of vigias.keys()) {
      if (vistos.has(identidade)) continue
      vigias.delete(identidade)
      sidsRecebidos.delete(identidade)
      basesRecebidas.delete(identidade)
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
