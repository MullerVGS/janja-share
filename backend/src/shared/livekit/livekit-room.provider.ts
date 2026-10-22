import { Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { SfuIndisponivel } from '../erros'
import { env } from '../env'

/** Fixa e sem ninguém dentro: guardada no SFU, fora do saguão e fora do teto das acordadas. */
export function estaAdormecida(sala: Pick<SalaNoSfu, 'fixa' | 'pessoas'>): boolean {
  return sala.fixa === true && sala.pessoas.length === 0
}

/** O que a encarnação guarda no metadata do SFU. A assinatura só existe depois de um ajuste. */
export interface MetadataDaSala {
  slug: string
  nome: string
  privada: boolean
  fixa: boolean
  /**
   * O link assinado do momento do último ajuste de nome ou visibilidade — é por ele que quem
   * está dentro recebe o link novo. Quem entra depois ganha o seu nas credenciais.
   */
  assinatura?: string | null
  /**
   * Slugs que esta encarnação já teve, do mais recente ao mais antigo. É por eles que um link
   * assinado de antes da troca de nome chega à Sala renomeada, em vez de recriar a antiga.
   */
  anteriores?: string[]
}

export interface ParticipanteSala {
  identidade: string
  nome: string
  publicandoTela: boolean
  /** Publica microfone e ele não está mudo. Ausente nos dublês antigos, conta como fechado. */
  microfoneAberto?: boolean
}

/**
 * Quem está na Sala como a coluna de salas mostra: o nome, se a Tela da pessoa está no ar e se
 * o microfone está aberto. Só o que o SFU já sabe — sem identidade, que não sai do servidor.
 */
export interface PresenteNaSala {
  nome: string
  aoVivo: boolean
  microfoneAberto: boolean
}

/**
 * Uma sala tal como o SFU a vê. Visibilidade e guarda vivem no metadata do próprio SFU, junto
 * com a encarnação (ADR 0006, ADR 0013).
 *
 * `slug` e `nome` vêm do `metadata` da sala, não do `name` interno. Esse nome usa
 * `<slug>-<nonce>`, para um JWT pré-emitido para o nome óbvio de uma sala ("jogatina") não
 * servir pra entrar numa sala futura com aquele nome. `nomeNoSfu` é esse nome real — é o que
 * vai no grant do token (`room`), nunca `slug`.
 */
export interface SalaNoSfu {
  slug: string
  nomeNoSfu: string
  nome: string
  /** Ausente só em dublês/encarnações antigas; ausência significa sala pública. */
  privada?: boolean
  /**
   * Sala fixa: adormece em vez de morrer quando todos saem (ADR 0013). Ausente em
   * dublês/encarnações antigas; ausência significa a efêmera de sempre.
   */
  fixa?: boolean
  /** Ver `MetadataDaSala.anteriores`. Ausente quando a Sala nunca trocou de slug. */
  anteriores?: string[]
  pessoas: string[]
  /** As mesmas pessoas de `pessoas`, com Tela e microfone. Ausente em dublês antigos. */
  presentes?: PresenteNaSala[]
  telasNoAr: number
  cheia: boolean
}

const TEMPO_VAZIA_S = 60
const TEMPO_CARENCIA_S = 120
/**
 * Quanto o SFU segura a Sala fixa depois que o último sai. O LiveKit conta o `departureTimeout`
 * a partir da última saída, então cada encontro empurra o prazo adiante sozinho. 7 dias cobrem
 * 91% das voltas medidas de um mesmo grupo.
 */
export const GUARDA_DA_SALA_FIXA_S = 7 * 24 * 60 * 60
const LOTACAO_MAXIMA = 30
const CACHE_MS = 2000
const TAMANHO_NONCE = 4 // 4 bytes = 8 hex — curto, mas caro demais para adivinhar num nome só

@Injectable()
export class LivekitRoomProvider {
  private cache: { dados: SalaNoSfu[]; em: number } | null = null

  private cliente(): RoomServiceClient {
    const { livekitHostInterno, livekitApiKey, livekitApiSecret } = env()
    return new RoomServiceClient(livekitHostInterno, livekitApiKey, livekitApiSecret)
  }

  /** Nunca engole erro: sala é a verdade do SFU, mentir que uma sala não tem gente é pior que quebrar. */
  async participantes(nomeNoSfu: string): Promise<ParticipanteSala[]> {
    let lista
    try {
      lista = await this.cliente().listParticipants(nomeNoSfu)
    } catch {
      throw new SfuIndisponivel()
    }
    return lista.map((p) => ({
      identidade: p.identity,
      nome: p.name,
      publicandoTela: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE),
      microfoneAberto: p.tracks.some((t) => t.source === TrackSource.MICROPHONE && !t.muted),
    }))
  }

  /**
   * Cache de 2s no processo — várias abas abertas não multiplicam chamadas ao SFU. `agora` é
   * injetado como parâmetro com valor padrão (não no construtor) para o teste controlar o tempo
   * sem timers reais, sem precisar do container de DI para isso.
   *
   * Lança SfuIndisponivel se o SFU não responder — devolver lista vazia mentiria "não há
   * salas" (contrato). Serve GET /api/salas — para checagem de unicidade/teto na criação, ver
   * `listarSalasSemCache`: aqui a leitura pode ter até 2s de atraso, lá não pode.
   */
  async listarSalas(agora = Date.now()): Promise<SalaNoSfu[]> {
    if (this.cache && agora - this.cache.em < CACHE_MS) return this.cache.dados
    return this.buscarSalasDoSfu(agora)
  }

  /**
   * Mesma leitura, sem servir do cache — usada por `CriarSalaUseCase` para decidir unicidade de
   * slug e teto global. Com o cache normal, um segundo POST dentro da janela de 2s via
   * `listarSalas()` não veria a sala que acabou de nascer: passaria pela checagem de "slug já
   * existe" e criaria uma segunda encarnação do mesmo nome.
   */
  async listarSalasSemCache(agora = Date.now()): Promise<SalaNoSfu[]> {
    return this.buscarSalasDoSfu(agora)
  }

  private async buscarSalasDoSfu(agora: number): Promise<SalaNoSfu[]> {
    let salas
    try {
      salas = await this.cliente().listRooms()
    } catch {
      throw new SfuIndisponivel()
    }

    const dados = await Promise.all(
      salas.map(async (sala) => {
        // Sala com ninguém dentro não paga a ida ao SFU: com dezenas de Salas adormecidas, cada
        // leitura da lista viraria dezenas de chamadas. O contador do SFU atrasa até 5 s numa
        // entrada recém-feita — o pior caso é a Sala aparecer vazia por uma volta do saguão.
        const pessoas = sala.numParticipants > 0 ? await this.participantes(sala.name) : []
        const meta = metadataDaSala(sala.metadata)
        return {
          slug: meta.slug ?? sala.name,
          nomeNoSfu: sala.name,
          nome: meta.nome ?? meta.slug ?? sala.name,
          privada: meta.privada,
          fixa: meta.fixa,
          ...(meta.anteriores.length > 0 ? { anteriores: meta.anteriores } : {}),
          pessoas: pessoas.map((p) => p.nome),
          presentes: pessoas.map((p) => ({
            nome: p.nome,
            aoVivo: p.publicandoTela,
            microfoneAberto: p.microfoneAberto === true,
          })),
          telasNoAr: pessoas.filter((p) => p.publicandoTela).length,
          cheia: pessoas.length >= LOTACAO_MAXIMA,
        }
      }),
    )

    this.cache = { dados, em: agora }
    return dados
  }

  /**
   * `createRoom` com os valores fixos do contrato. O nome real no SFU ganha um nonce
   * (`<slug>-<nonce>`) — devolvido aqui porque é ele, não o slug, que vai no grant do
   * token. `slug`, nome de exibição, visibilidade e guarda vão só no metadata.
   *
   * A Sala fixa nasce com a carência de 7 dias; a efêmera, com os 120 s de sempre. O
   * `emptyTimeout` é o mesmo nas duas: ele só conta antes da primeira entrada.
   *
   * Invalida o cache ao final: sem isso, uma leitura cacheada por `listarSalas()` nos
   * próximos 2s continuaria sem enxergar a sala recém-criada.
   */
  async criarSala(dados: { slug: string; nomeDaSala: string; privada: boolean; fixa: boolean }): Promise<string> {
    const nomeNoSfu = `${dados.slug}-${randomBytes(TAMANHO_NONCE).toString('hex')}`
    const metadata: MetadataDaSala = { slug: dados.slug, nome: dados.nomeDaSala, privada: dados.privada, fixa: dados.fixa }
    try {
      await this.cliente().createRoom({
        name: nomeNoSfu,
        emptyTimeout: TEMPO_VAZIA_S,
        departureTimeout: dados.fixa ? GUARDA_DA_SALA_FIXA_S : TEMPO_CARENCIA_S,
        maxParticipants: LOTACAO_MAXIMA,
        metadata: JSON.stringify(metadata),
      })
    } catch {
      throw new SfuIndisponivel()
    }
    this.cache = null
    return nomeNoSfu
  }

  /**
   * Troca nome, slug e visibilidade de uma encarnação viva sem recriá-la: o SFU guarda o
   * metadata novo e o entrega a quem está dentro (`RoomMetadataChanged`). O nome no SFU — e com
   * ele cada token já emitido — não muda.
   */
  async ajustarSala(nomeNoSfu: string, metadata: MetadataDaSala): Promise<void> {
    try {
      await this.cliente().updateRoomMetadata(nomeNoSfu, JSON.stringify(metadata))
    } catch {
      throw new SfuIndisponivel()
    }
    this.cache = null
  }
}

interface MetadataLido {
  slug: string | null
  nome: string | null
  privada: boolean
  fixa: boolean
  anteriores: string[]
}

function metadataDaSala(metadata: string): MetadataLido {
  try {
    const dados = JSON.parse(metadata) as { slug?: unknown; nome?: unknown; privada?: unknown; fixa?: unknown; anteriores?: unknown }
    return {
      slug: typeof dados.slug === 'string' ? dados.slug : null,
      nome: typeof dados.nome === 'string' ? dados.nome : null,
      privada: dados.privada === true,
      fixa: dados.fixa === true,
      anteriores: Array.isArray(dados.anteriores) ? dados.anteriores.filter((s): s is string => typeof s === 'string') : [],
    }
  } catch {
    return { slug: null, nome: null, privada: false, fixa: false, anteriores: [] }
  }
}
