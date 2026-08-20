import { Injectable } from '@nestjs/common'
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { SfuIndisponivel } from '../erros'
import { env } from '../env'

export interface ParticipanteSala {
  identidade: string
  nome: string
  publicandoTela: boolean
}

/** Uma sala tal como o SFU a vê — sem `temSenha` (isso é do banco, ver ListarSalasUseCase). */
export interface SalaNoSfu {
  slug: string
  nome: string
  pessoas: string[]
  telasNoAr: number
  cheia: boolean
}

const TEMPO_VAZIA_S = 60
const TEMPO_CARENCIA_S = 120
const LOTACAO_MAXIMA = 12
const CACHE_MS = 2000

@Injectable()
export class LivekitRoomProvider {
  private cache: { dados: SalaNoSfu[]; em: number } | null = null

  private cliente(): RoomServiceClient {
    const { livekitHostInterno, livekitApiKey, livekitApiSecret } = env()
    return new RoomServiceClient(livekitHostInterno, livekitApiKey, livekitApiSecret)
  }

  /** Nunca engole erro: sala é a verdade do SFU, mentir que uma sala não tem gente é pior que quebrar. */
  async participantes(slug: string): Promise<ParticipanteSala[]> {
    let lista
    try {
      lista = await this.cliente().listParticipants(slug)
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
   * injetado como parâmetro (não no construtor) para o teste controlar o tempo sem timers reais,
   * no mesmo estilo de `calcularEstado(convite, agora)`.
   *
   * Lança SfuIndisponivel se o SFU não responder — devolver lista vazia mentiria "não há
   * salas" (contrato).
   */
  async listarSalas(agora = Date.now()): Promise<SalaNoSfu[]> {
    if (this.cache && agora - this.cache.em < CACHE_MS) return this.cache.dados

    let salas
    try {
      salas = await this.cliente().listRooms()
    } catch {
      throw new SfuIndisponivel()
    }

    const dados = await Promise.all(
      salas.map(async (sala) => {
        const pessoas = await this.participantes(sala.name)
        return {
          slug: sala.name,
          nome: nomeDaMetadata(sala.metadata) ?? sala.name,
          pessoas: pessoas.map((p) => p.nome),
          telasNoAr: pessoas.filter((p) => p.publicandoTela).length,
          cheia: pessoas.length >= LOTACAO_MAXIMA,
        }
      }),
    )

    this.cache = { dados, em: agora }
    return dados
  }

  /** `createRoom` com os valores fixos do contrato — o nome de exibição vai só no metadata, nunca a senha. */
  async criarSala(dados: { slug: string; nomeDaSala: string }): Promise<void> {
    try {
      await this.cliente().createRoom({
        name: dados.slug,
        emptyTimeout: TEMPO_VAZIA_S,
        departureTimeout: TEMPO_CARENCIA_S,
        maxParticipants: LOTACAO_MAXIMA,
        metadata: JSON.stringify({ nome: dados.nomeDaSala }),
      })
    } catch {
      throw new SfuIndisponivel()
    }
  }
}

function nomeDaMetadata(metadata: string): string | null {
  try {
    const dados = JSON.parse(metadata) as { nome?: unknown }
    return typeof dados.nome === 'string' ? dados.nome : null
  } catch {
    return null
  }
}
