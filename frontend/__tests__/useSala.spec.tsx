import { act, renderHook } from '@testing-library/react'
import { ConnectionState, RoomEvent } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { useSala } from '../src/sala/useSala'
import { credenciaisFalsas } from './apoio/sessaoFalsa'

const construidas = vi.hoisted(() => [] as unknown[])
/** A última sala criada, para o teste disparar nela os eventos que o SDK dispararia. */
const ultima = vi.hoisted(() => ({ sala: null as { emitir(evento: string, ...dados: unknown[]): void } | null }))

vi.mock('livekit-client', async (importar) => {
  const real = await importar<typeof import('livekit-client')>()
  class RoomFalsa {
    canPlaybackAudio = true
    ouvintes = new Map<string, ((...dados: unknown[]) => void)[]>()
    constructor(opcoes: unknown) {
      construidas.push(opcoes)
      ultima.sala = this
    }
    on(evento: string, ouvinte: (...dados: unknown[]) => void) {
      this.ouvintes.set(evento, [...(this.ouvintes.get(evento) ?? []), ouvinte])
      return this
    }
    emitir(evento: string, ...dados: unknown[]) {
      for (const ouvinte of this.ouvintes.get(evento) ?? []) ouvinte(...dados)
    }
    removeAllListeners() {
      this.ouvintes.clear()
    }
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

  it('conectar também recalcula o palco: sem isso o próprio quadro fica em "?" até o evento seguinte', () => {
    // As credenciais têm de ser a mesma referência a cada render: elas são a dependência do
    // efeito que abre a sala, e um objeto novo por render abriria uma sala nova sem parar.
    const credenciais = credenciaisFalsas(Date.now() + 60_000)
    const { result } = renderHook(() => useSala(credenciais))
    const antes = result.current.versao

    act(() => ultima.sala?.emitir(RoomEvent.ConnectionStateChanged, ConnectionState.Connected))

    expect(result.current.conexao).toBe(ConnectionState.Connected)
    expect(result.current.versao).toBe(antes + 1)
  })
})
