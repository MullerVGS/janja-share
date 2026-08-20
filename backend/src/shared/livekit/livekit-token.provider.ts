import { Injectable } from '@nestjs/common'
import { AccessToken } from 'livekit-server-sdk'
import { env } from '../env'

const TTL_TOKEN = '8h'

@Injectable()
export class LivekitTokenProvider {
  /**
   * Grant no nome interno da sala, nunca no slug público, com mídia, dados e TTL de 8h.
   */
  async emitir(nomeNoSfu: string, identidade: string, nome: string): Promise<string> {
    const { livekitApiKey, livekitApiSecret } = env()
    const at = new AccessToken(livekitApiKey, livekitApiSecret, { identity: identidade, name: nome, ttl: TTL_TOKEN })
    at.addGrant({ roomJoin: true, room: nomeNoSfu, canPublish: true, canSubscribe: true, canPublishData: true })
    return at.toJwt()
  }
}
