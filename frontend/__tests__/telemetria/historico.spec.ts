import { describe, expect, it } from 'vitest'
import { anotar, TETO_DO_HISTORICO, ultima } from '../../src/telemetria/historico'

describe('histórico de amostras', () => {
  it('anota no fim, sem mutar a lista recebida', () => {
    const original = [1, 2]
    const novo = anotar(original, 3)
    expect(novo).toEqual([1, 2, 3])
    expect(original).toEqual([1, 2])
  })

  it('descarta o começo ao passar do teto — são 2 minutos a 1 Hz, nada mais', () => {
    let historico: number[] = []
    for (let indice = 0; indice < TETO_DO_HISTORICO + 7; indice += 1) historico = anotar(historico, indice)

    expect(TETO_DO_HISTORICO).toBe(120)
    expect(historico).toHaveLength(TETO_DO_HISTORICO)
    expect(historico[0]).toBe(7)
    expect(ultima(historico)).toBe(TETO_DO_HISTORICO + 6)
  })

  it('a última de um histórico vazio é null', () => {
    expect(ultima([])).toBeNull()
  })
})
