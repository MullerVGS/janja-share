import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SomSaindo } from '../src/telas/Sala/SomSaindo'
import { habilitarWebAudio } from './apoio/navegador'

const faixa = { id: 'som-da-tela' } as unknown as MediaStreamTrack

describe('indicador de som saindo', () => {
  it('sem WebAudio no navegador não há nada a mostrar — barra sempre zerada mentiria', () => {
    const { container } = render(<SomSaindo faixa={faixa} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('indicador de som saindo: a medição', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }))
  afterEach(() => vi.useRealTimers())

  it('mede a faixa ~10 vezes por segundo e escreve o nível direto no elemento', async () => {
    const webAudio = habilitarWebAudio()
    const { unmount } = render(<SomSaindo faixa={faixa} />)

    const indicador = screen.getByTitle('som saindo')
    expect(indicador.style.getPropertyValue('--nivel')).toBe('0')
    expect(webAudio.faixas).toEqual([faixa])

    webAudio.amplitude = 255
    await act(async () => vi.advanceTimersByTime(100))
    expect(indicador.style.getPropertyValue('--nivel')).toBe('1.00')

    webAudio.amplitude = 0
    await act(async () => vi.advanceTimersByTime(100))
    expect(indicador.style.getPropertyValue('--nivel')).toBe('0.00')

    unmount()
    expect(webAudio.abertos).toBe(0)
  })
})
