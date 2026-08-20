import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSala } from '../src/sala/useSala'
import { credenciaisFalsas } from './apoio/sessaoFalsa'

const construidas = vi.hoisted(() => [] as unknown[])

vi.mock('livekit-client', async (importar) => {
  const real = await importar<typeof import('livekit-client')>()
  class RoomFalsa {
    canPlaybackAudio = true
    constructor(opcoes: unknown) {
      construidas.push(opcoes)
    }
    on() {
      return this
    }
    removeAllListeners() {}
    connect() {
      return new Promise<void>(() => {})
    }
    disconnect() {
      return Promise.resolve()
    }
  }
  return { ...real, Room: RoomFalsa }
})

describe('useSala', () => {
  it('abre a sala sem adaptiveStream (mataria o PiP e não tem camada para escolher) e com dynacast', () => {
    const credenciais = credenciaisFalsas(Date.now() + 60_000)
    renderHook(() => useSala(credenciais))
    expect(construidas).toEqual([{ adaptiveStream: false, dynacast: true }])
  })
})
