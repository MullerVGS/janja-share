import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalTrack } from 'livekit-client'
import { guardarCaptura, retirarCaptura } from '../src/sala/capturaPendente'

const FAIXA = { kind: 'video' } as never

/** Uma faixa com `stop()` espionável — para provar que o TTL e a sobrescrita realmente param. */
function faixaComStop(): LocalTrack {
  return { kind: 'video', stop: vi.fn() } as unknown as LocalTrack
}

afterEach(() => {
  retirarCaptura()
  vi.useRealTimers()
})

describe('captura pendente: a entrega entre a home e a sala', () => {
  it('sem nada guardado, retirar devolve null', () => {
    expect(retirarCaptura()).toBeNull()
  })

  it('o que foi guardado sai inteiro', () => {
    guardarCaptura([FAIXA])
    expect(retirarCaptura()).toEqual([FAIXA])
  })

  it('retirar é destrutivo: a segunda chamada não repete a entrega', () => {
    guardarCaptura([FAIXA])
    retirarCaptura()
    expect(retirarCaptura()).toBeNull()
  })
})

describe('captura pendente: quando ninguém vem buscar', () => {
  it('guardar de novo sem retirar para o que estava lá — não é um vazamento permanente', () => {
    const primeira = faixaComStop()
    const segunda = faixaComStop()

    guardarCaptura([primeira])
    guardarCaptura([segunda])

    expect(primeira.stop).toHaveBeenCalledOnce()
    expect(retirarCaptura()).toEqual([segunda])
  })

  it('30 s sem retirar, o TTL para as faixas sozinho — sem depender de nenhum ciclo de vida do React', () => {
    vi.useFakeTimers()
    const faixa = faixaComStop()
    guardarCaptura([faixa])

    vi.advanceTimersByTime(30_000)

    expect(faixa.stop).toHaveBeenCalledOnce()
    expect(retirarCaptura()).toBeNull()
  })

  it('retirar dentro do prazo cancela o TTL — a faixa entregue não é parada depois', () => {
    vi.useFakeTimers()
    const faixa = faixaComStop()
    guardarCaptura([faixa])

    retirarCaptura()
    vi.advanceTimersByTime(30_000)

    expect(faixa.stop).not.toHaveBeenCalled()
  })
})
