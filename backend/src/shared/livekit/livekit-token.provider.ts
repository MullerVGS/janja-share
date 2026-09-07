import { Injectable } from '@nestjs/common'
import { AccessToken, TrackSource } from 'livekit-server-sdk'
import { env } from '../env'

const TTL_TOKEN = '8h'

/** Voz, tela e o som da tela. Sem câmera: o projeto é compartilhar tela, não videochamada. */
const FONTES_PUBLICAVEIS = [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]

@Injectable()
export class LivekitTokenProvider {
  /**
   * Grant no nome interno da sala, nunca no slug público, com mídia, dados e TTL de 8h.
   *
   * A câmera fica fora das fontes publicáveis: é o SFU quem a recusa, e não só o cliente que
   * deixou de oferecê-la — um cliente antigo em cache, ou modificado, esbarra aqui.
   */
  async emitir(nomeNoSfu: string, identidade: string, nome: string): Promise<string> {
    const { livekitApiKey, livekitApiSecret } = env()
    const at = new AccessToken(livekitApiKey, livekitApiSecret, { identity: identidade, name: nome, ttl: TTL_TOKEN })
    at.addGrant({
      roomJoin: true,
      room: nomeNoSfu,
      canPublish: true,
      canPublishSources: FONTES_PUBLICAVEIS,
      canSubscribe: true,
      canPublishData: true,
    })
    return at.toJwt()
  }
}
