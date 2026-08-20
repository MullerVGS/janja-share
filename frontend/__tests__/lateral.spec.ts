import { describe, expect, it } from 'vitest'
import { ABAS, LARGURA_MINIMA_DA_LATERAL, limitarLargura } from '../src/sala/lateral'

describe('lateral', () => {
  it('tem as três abas, nesta ordem', () => {
    expect(ABAS.map((aba) => aba.valor)).toEqual(['qualidade', 'transmissao', 'chat'])
  })

  it('a largura fica entre o mínimo e metade da janela', () => {
    expect(LARGURA_MINIMA_DA_LATERAL).toBe(300)
    expect(limitarLargura(100, 1600)).toBe(300)
    expect(limitarLargura(420, 1600)).toBe(420)
    expect(limitarLargura(1200, 1600)).toBe(800)
  })

  it('numa janela estreita o mínimo vence a metade', () => {
    expect(limitarLargura(500, 400)).toBe(300)
  })
})
