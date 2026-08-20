import { Injectable } from '@nestjs/common'
import { AccessToken } from 'livekit-server-sdk'
import { env } from '../env'

const TTL_TOKEN = '8h'

@Injectable()
export class LivekitTokenProvider {
  /** Grant do contrato: roomJoin na SALA fixa, publicar/assinar mídia e dados, TTL de 8h. */
  async emitir(identidade: string, nome: string): Promise<string> {
    const { livekitApiKey, livekitApiSecret, sala } = env()
    const at = new AccessToken(livekitApiKey, livekitApiSecret, { identity: identidade, name: nome, ttl: TTL_TOKEN })
    at.addGrant({ roomJoin: true, room: sala, canPublish: true, canSubscribe: true, canPublishData: true })
    return at.toJwt()
  }
}
