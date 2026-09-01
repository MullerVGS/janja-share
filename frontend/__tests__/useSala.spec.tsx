import { act, renderHook } from '@testing-library/react'
import { ConnectionError, ConnectionState, DisconnectReason, RoomEvent } from 'livekit-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ATRASOS_DA_RECONEXAO_MS, ESPERAS_DO_RELIGAR_MS, useSala } from '../src/sala/useSala'
import { credenciaisFalsas } from './apoio/sessaoFalsa'

const construidas = vi.hoisted(() => [] as unknown[])
/** A última sala criada, para o teste disparar nela os eventos que o SDK dispararia. */
const ultima = vi.hoisted(() => ({ sala: null as { emitir(evento: string, ...dados: unknown[]): void } | null }))
/** Cada `connect` pedido à sala, com o que decide o destino dele. */
const conexoes = vi.hoisted(
  () => [] as { url: string; token: string; resolver(): void; rejeitar(falha: unknown): void }[],
)

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
    connect(url: string, token: string) {
      return new Promise<void>((resolver, rejeitar) => {
        conexoes.push({ url, token, resolver, rejeitar })
      })
    }
    disconnect() {
      return Promise.resolve()
    }
  }
  return { ...real, Room: RoomFalsa }
})

describe('useSala', () => {
  afterEach(() => {
    construidas.length = 0
    conexoes.length = 0
    vi.useRealTimers()
  })

  it('abre a sala sem adaptiveStream (mataria o PiP) e sem dynacast (não pausa o encoder de quem ninguém assina)', () => {
    const credenciais = credenciaisFalsas(Date.now() + 60_000)
    renderHook(() => useSala(credenciais))
    expect(construidas).toEqual([{ adaptiveStream: false, dynacast: false, reconnectPolicy: expect.any(Object) }])
  })

  it('o SDK insiste por pelo menos três minutos antes de desistir — notebook acordando leva mais que os 44 s de fábrica', () => {
    const total = ATRASOS_DA_RECONEXAO_MS.reduce((soma, atraso) => soma + atraso, 0)
    expect(total).toBeGreaterThanOrEqual(3 * 60_000)
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

  describe('quando o SDK desiste', () => {
    function derrubar(motivo: DisconnectReason | undefined) {
      act(() => ultima.sala?.emitir(RoomEvent.Disconnected, motivo))
    }

    it('queda que não foi a pessoa saindo religa sozinha, com as mesmas credenciais', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { result } = renderHook(() => useSala(credenciais))
      expect(conexoes).toHaveLength(1)

      derrubar(DisconnectReason.STATE_MISMATCH)

      expect(result.current.queda).toEqual({ tentativa: 1 })
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[0]!))
      expect(conexoes).toHaveLength(2)
      expect(conexoes[1]).toMatchObject({ url: credenciais.urlSfu, token: credenciais.token })

      await act(async () => {
        conexoes[1]!.resolver()
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.queda).toBeNull()
    })

    it('uma tentativa que falha pela rede espera mais e tenta de novo', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { result } = renderHook(() => useSala(credenciais))
      derrubar(DisconnectReason.STATE_MISMATCH)
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[0]!))

      await act(async () => {
        conexoes[1]!.rejeitar(new Error('sem rede'))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(result.current.queda).toEqual({ tentativa: 2 })
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[1]!))
      expect(conexoes).toHaveLength(3)
    })

    it('uma queda no meio do próprio religar não abre uma segunda fila de tentativas', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      renderHook(() => useSala(credenciais))
      derrubar(DisconnectReason.STATE_MISMATCH)
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[0]!))

      // O `connect` falha e, como o SDK faz, a sala anuncia a queda de novo.
      await act(async () => {
        conexoes[1]!.rejeitar(new Error('sem rede'))
        await vi.advanceTimersByTimeAsync(0)
      })
      derrubar(DisconnectReason.STATE_MISMATCH)
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[1]!))

      expect(conexoes).toHaveLength(3)
    })

    it('sair por vontade própria não religa', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { result } = renderHook(() => useSala(credenciais))

      derrubar(DisconnectReason.CLIENT_INITIATED)
      await act(() => vi.advanceTimersByTimeAsync(60_000))

      expect(result.current.queda).toBeNull()
      expect(conexoes).toHaveLength(1)
    })

    it('identidade tomada por outra aba não religa (viraria cabo de guerra) e explica o que houve', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { result } = renderHook(() => useSala(credenciais))

      derrubar(DisconnectReason.DUPLICATE_IDENTITY)
      await act(() => vi.advanceTimersByTimeAsync(60_000))

      expect(result.current.queda).toBeNull()
      expect(result.current.erro).toMatch(/outra aba/)
      expect(conexoes).toHaveLength(1)
    })

    it('recusa do servidor (sessão vencida) para de insistir e vira erro', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { result } = renderHook(() => useSala(credenciais))
      derrubar(DisconnectReason.STATE_MISMATCH)
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[0]!))

      await act(async () => {
        conexoes[1]!.rejeitar(ConnectionError.notAllowed('token recusado', 401))
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(result.current.queda).toBeNull()
      expect(result.current.erro).toMatch(/venceu/)
      expect(conexoes).toHaveLength(2)
    })

    it('sala que morreu enquanto a pessoa estava fora: para de insistir e explica', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { result } = renderHook(() => useSala(credenciais))
      derrubar(DisconnectReason.STATE_MISMATCH)
      await act(() => vi.advanceTimersByTimeAsync(ESPERAS_DO_RELIGAR_MS[0]!))

      await act(async () => {
        conexoes[1]!.rejeitar(ConnectionError.notAllowed('requested room does not exist', 404))
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(result.current.queda).toBeNull()
      expect(result.current.erro).toMatch(/encerrada/)
      expect(conexoes).toHaveLength(2)
    })

    it('desmontar no meio da espera não religa uma sala descartada', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const credenciais = credenciaisFalsas(Date.now() + 60_000)
      const { unmount } = renderHook(() => useSala(credenciais))
      derrubar(DisconnectReason.STATE_MISMATCH)

      unmount()
      await act(() => vi.advanceTimersByTimeAsync(60_000))

      expect(conexoes).toHaveLength(1)
    })
  })
})
