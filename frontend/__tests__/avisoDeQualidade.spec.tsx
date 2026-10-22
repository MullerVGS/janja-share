import { act, renderHook } from '@testing-library/react'
import { ConnectionQuality } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AQUECIMENTO_MS, avisoParaQuemAssiste, avisoParaQuemCompartilha } from '../src/sala/avisoDeQualidade'
import { useAquecido } from '../src/sala/useAquecido'

const { Poor, Good, Lost } = ConnectionQuality

describe('aviso de qualidade para quem assiste', () => {
  const base = { minha: Good, doDono: Good, nomeDoDono: 'Bia', aquecido: true }

  it('com as duas redes boas, nada a dizer', () => {
    expect(avisoParaQuemAssiste(base)).toBeNull()
  })

  it('a minha rede fraca é dita como minha — e vem antes da do dono', () => {
    expect(avisoParaQuemAssiste({ ...base, minha: Poor, doDono: Poor })).toBe('Sua conexão está fraca — a imagem pode travar aqui.')
  })

  it('a rede fraca de quem compartilha é dita como dela', () => {
    expect(avisoParaQuemAssiste({ ...base, doDono: Poor })).toBe(
      'A conexão de Bia está fraca — a imagem pode travar para todos.',
    )
  })

  it('antes de aquecer, nada — a medida da entrada ainda não assentou', () => {
    expect(avisoParaQuemAssiste({ ...base, minha: Poor, aquecido: false })).toBeNull()
  })

  it('caída não é aviso de qualidade: é o cartão de estado quem diz', () => {
    expect(avisoParaQuemAssiste({ ...base, doDono: Lost })).toBeNull()
  })
})

describe('aviso de qualidade para quem compartilha', () => {
  it('só com alguém assistindo e depois de aquecer', () => {
    expect(avisoParaQuemCompartilha({ minha: Poor, assistindo: 0, aquecido: true })).toBeNull()
    expect(avisoParaQuemCompartilha({ minha: Poor, assistindo: 2, aquecido: false })).toBeNull()
    expect(avisoParaQuemCompartilha({ minha: Poor, assistindo: 2, aquecido: true })).toBe(
      'Sua conexão está fraca — quem assiste pode ver sua tela travando.',
    )
    expect(avisoParaQuemCompartilha({ minha: Good, assistindo: 2, aquecido: true })).toBeNull()
  })
})

describe('useAquecido', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fica quente depois do prazo, e cada chave nova recomeça a contar', () => {
    const { result, rerender } = renderHook(({ chave }) => useAquecido(chave, AQUECIMENTO_MS), {
      initialProps: { chave: 'a' as string | null },
    })
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(AQUECIMENTO_MS))
    expect(result.current).toBe(true)

    rerender({ chave: 'b' })
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(AQUECIMENTO_MS))
    expect(result.current).toBe(true)

    rerender({ chave: null })
    expect(result.current).toBe(false)
  })
})
