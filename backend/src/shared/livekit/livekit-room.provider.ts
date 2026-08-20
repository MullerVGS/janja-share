import { Injectable } from '@nestjs/common'
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { env } from '../env'

export interface ParticipanteSala {
  identidade: string
  nome: string
  entrouEm: string
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
      return lista.map((p) => ({
        identidade: p.identity,
        nome: p.name,
        entrouEm: new Date(Number(p.joinedAtMs)).toISOString(),
        publicandoTela: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE),
      }))
    } catch {
      return []
    }
  }
}
