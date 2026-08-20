import { TokenVerifier } from 'livekit-server-sdk'
import { LivekitTokenProvider } from '../src/shared/livekit/livekit-token.provider'

const OITO_HORAS_S = 8 * 60 * 60

describe('LivekitTokenProvider — emitir()', () => {
  it('assina um JWT cujo grant aponta para o nome interno, não para o slug', async () => {
    const provider = new LivekitTokenProvider()

    const jwt = await provider.emitir('jogatina-a1b2c3d4', 'ana-112233', 'Ana')

    // Verificação de verdade (assinatura + claims), não decodificação cega: prova que o JWT
    // valida contra a mesma chave/segredo que o LiveKit usaria.
    const verificador = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)
    const claims = await verificador.verify(jwt)

    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: 'jogatina-a1b2c3d4',
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    expect(claims.sub).toBe('ana-112233')
    expect(claims.name).toBe('Ana')
  })

  it('TTL de 8h: exp - nbf bate em 28800s', async () => {
    const provider = new LivekitTokenProvider()
    const jwt = await provider.emitir('jogatina-a1b2c3d4', 'ana-112233', 'Ana')

    const verificador = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)
    const claims = await verificador.verify(jwt)

    expect(claims.exp).toBeDefined()
    expect(claims.nbf).toBeDefined()
    expect(claims.exp! - claims.nbf!).toBe(OITO_HORAS_S)
  })

  it('duas salas diferentes recebem grants com `room` diferente', async () => {
    const provider = new LivekitTokenProvider()
    const verificador = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)

    const jwtA = await provider.emitir('jogatina-aaaa1111', 'ana-112233', 'Ana')
    const jwtB = await provider.emitir('familia-bbbb2222', 'ana-112233', 'Ana')

    const claimsA = await verificador.verify(jwtA)
    const claimsB = await verificador.verify(jwtB)

    expect(claimsA.video?.room).toBe('jogatina-aaaa1111')
    expect(claimsB.video?.room).toBe('familia-bbbb2222')
  })
})
