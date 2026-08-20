import { Injectable } from '@nestjs/common'
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { env } from '../env'

export interface ParticipanteSala {
  identidade: string
  nome: string
  /** `null` quando o SFU não informa `joinedAt` — ver a conversão em participantes(). */
  entrouEm: string | null
  publicandoTela: boolean
}

@Injectable()
export class LivekitRoomProvider {
  /** Nunca lança: se o SFU não responder, o painel de admin não pode quebrar (contrato). */
  async participantes(): Promise<ParticipanteSala[]> {
    const { livekitHostInterno, livekitApiKey, livekitApiSecret, sala } = env()
    const svc = new RoomServiceClient(livekitHostInterno, livekitApiKey, livekitApiSecret)
    try {
      const lista = await svc.listParticipants(sala)
      return lista.map((p) => {
        // `joinedAtMs` é bigint no protobuf e chega zerado quando o SFU ainda não registrou a
        // entrada. `new Date(0)` viraria "31/12/1969" no painel — data falsa é pior que ausência.
        const entradaMs = Number(p.joinedAtMs) || null
        return {
          identidade: p.identity,
          nome: p.name,
          entrouEm: entradaMs === null ? null : new Date(entradaMs).toISOString(),
          publicandoTela: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE),
        }
      })
    } catch {
      return []
    }
  }
}
