import { Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { SfuIndisponivel } from '../erros'
import { env } from '../env'

export interface ParticipanteSala {
  identidade: string
  nome: string
  publicandoTela: boolean
}

/**
 * Uma sala tal como o SFU a vê — sem `temSenha` (isso é do banco, ver ListarSalasUseCase).
 *
 * `slug` e `nome` vêm do `metadata` da sala, não do `name` interno. Esse nome usa
 * `<slug>-<nonce>`, para um JWT pré-emitido para o
 * nome óbvio de uma sala ("jogatina") não servir pra entrar numa sala futura com aquele nome e
 * senha. `nomeNoSfu` é esse nome real — é o que vai no grant do token (`room`), nunca `slug`.
 */
export interface SalaNoSfu {
  slug: string
  nomeNoSfu: string
  nome: string
  pessoas: string[]
  telasNoAr: number
  cheia: boolean
}

const TEMPO_VAZIA_S = 60
const TEMPO_CARENCIA_S = 120
const LOTACAO_MAXIMA = 12
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
   * slug e teto global. Com o cache normal, um segundo POST dentro da janela de 2s
   * via `listarSalas()` não veria a sala que acabou de nascer: passaria pela checagem de
   * "slug já existe", chegaria em `salas.apagar(slug)` e destruiria o hash de uma sala que está
   * viva no SFU — a senha morre ali, antes mesmo de `criarSala` rodar.
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
        const pessoas = await this.participantes(sala.name)
        const meta = metadataDaSala(sala.metadata)
        return {
          slug: meta.slug ?? sala.name,
          nomeNoSfu: sala.name,
          nome: meta.nome ?? meta.slug ?? sala.name,
          pessoas: pessoas.map((p) => p.nome),
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
   * token. `slug` e o nome de exibição vão só no metadata; a senha, nunca.
   *
   * Invalida o cache ao final: sem isso, uma leitura cacheada por `listarSalas()` nos
   * próximos 2s continuaria sem enxergar a sala recém-criada.
   */
  async criarSala(dados: { slug: string; nomeDaSala: string }): Promise<string> {
    const nomeNoSfu = `${dados.slug}-${randomBytes(TAMANHO_NONCE).toString('hex')}`
    try {
      await this.cliente().createRoom({
        name: nomeNoSfu,
        emptyTimeout: TEMPO_VAZIA_S,
        departureTimeout: TEMPO_CARENCIA_S,
        maxParticipants: LOTACAO_MAXIMA,
        metadata: JSON.stringify({ slug: dados.slug, nome: dados.nomeDaSala }),
      })
    } catch {
      throw new SfuIndisponivel()
    }
    this.cache = null
    return nomeNoSfu
  }
}

function metadataDaSala(metadata: string): { slug: string | null; nome: string | null } {
  try {
    const dados = JSON.parse(metadata) as { slug?: unknown; nome?: unknown }
    return {
      slug: typeof dados.slug === 'string' ? dados.slug : null,
      nome: typeof dados.nome === 'string' ? dados.nome : null,
    }
  } catch {
    return { slug: null, nome: null }
  }
}
