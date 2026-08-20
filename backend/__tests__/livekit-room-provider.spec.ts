import { LivekitRoomProvider } from '../src/shared/livekit/livekit-room.provider'

describe('LivekitRoomProvider', () => {
  it('participantes() devolve [] em vez de lançar quando o SFU não responde (porta fechada de verdade)', async () => {
    const hostAnterior = process.env.LIVEKIT_HOST_INTERNO
    process.env.LIVEKIT_HOST_INTERNO = 'http://127.0.0.1:1'
    try {
      const provider = new LivekitRoomProvider()
      await expect(provider.participantes()).resolves.toEqual([])
    } finally {
      process.env.LIVEKIT_HOST_INTERNO = hostAnterior
    }
  })
})
