import { describe, expect, it } from 'vitest'
import { iniciaisDoNome } from '../src/ui/avatares'

describe('iniciaisDoNome', () => {
  it('nome com um só termo vira as duas primeiras letras, em maiúsculas', () => {
    expect(iniciaisDoNome('ana')).toBe('AN')
    // Nome de uma letra só não vira duas do nada.
    expect(iniciaisDoNome('Ê')).toBe('Ê')
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
