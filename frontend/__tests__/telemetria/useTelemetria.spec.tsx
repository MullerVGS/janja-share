import { act, renderHook } from '@testing-library/react'
import { RoomEvent, type Room } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTelemetria } from '../../src/telemetria/useTelemetria'

function salaFalsa() {
  const ouvintes = new Set<unknown>()
  return {
    ouvintes,
    localParticipant: {
      identity: 'eu',
      publishData: vi.fn(async () => {}),
      getTrackPublication: () => ({
        trackSid: 't1',
        track: {
          sender: {
            getParameters: () => ({ encodings: [{ active: true }] }),
            getStats: async () =>
              new Map([['s', { type: 'outbound-rtp', kind: 'video', timestamp: 1000, bytesSent: 0, framesEncoded: 0 }]]),
          },
        },
      }),
    },
    remoteParticipants: new Map(),
    on(evento: string, ouvinte: unknown) {
      if (evento === RoomEvent.DataReceived) ouvintes.add(ouvinte)
      return this
    },
    off(evento: string, ouvinte: unknown) {
      if (evento === RoomEvent.DataReceived) ouvintes.delete(ouvinte)
      return this
    },
  }
}

describe('useTelemetria', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sem sala é vazio; com sala, anota a cada segundo; trocar de sala zera e solta a anterior', async () => {
    const primeira = salaFalsa()
    const { result, rerender, unmount } = renderHook(({ sala }) => useTelemetria(sala), {
      initialProps: { sala: null as Room | null },
    })
    expect(result.current.emissor).toHaveLength(0)

    rerender({ sala: primeira as unknown as Room })
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(result.current.emissor).toHaveLength(2)
    expect(primeira.ouvintes.size).toBe(1)

    const segunda = salaFalsa()
    rerender({ sala: segunda as unknown as Room })
    expect(primeira.ouvintes.size).toBe(0)
    expect(result.current.emissor).toHaveLength(0)

    unmount()
    expect(segunda.ouvintes.size).toBe(0)
  })
})
