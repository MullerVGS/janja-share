import { describe, expect, it } from 'vitest'
import { corDoNome, iniciaisDoNome } from '../src/ui/avatares'

describe('iniciaisDoNome', () => {
  it('nome com um só termo vira a primeira letra maiúscula', () => {
    expect(iniciaisDoNome('ana')).toBe('A')
  })

  it('nome com sobrenome vira a primeira letra de cada um', () => {
    expect(iniciaisDoNome('Ana Silva')).toBe('AS')
  })

  it('nome com três termos usa só o primeiro e o último — não o do meio', () => {
    expect(iniciaisDoNome('Ana da Silva Muller')).toBe('AM')
  })

  it('espaço sobrando não confunde a conta', () => {
    expect(iniciaisDoNome('  Ana   Muller  ')).toBe('AM')
  })

  it('nome vazio devolve um placeholder, não quebra', () => {
    expect(iniciaisDoNome('')).toBe('?')
    expect(iniciaisDoNome('   ')).toBe('?')
  })
})

describe('corDoNome', () => {
  it('é determinística: o mesmo nome sempre dá a mesma cor', () => {
    expect(corDoNome('Ana')).toBe(corDoNome('Ana'))
  })

  it('nomes diferentes tendem a cores diferentes (não é uma constante disfarçada)', () => {
    const cores = new Set(['Ana', 'Bia', 'Caio', 'Duda', 'Enzo', 'Fê'].map(corDoNome))
    expect(cores.size).toBeGreaterThan(1)
  })

  it('devolve uma referência a um token de cor, nunca um hex solto', () => {
    expect(corDoNome('Ana')).toMatch(/^var\(--[a-z-]+\)$/)
  })
})
