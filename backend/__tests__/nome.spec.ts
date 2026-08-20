import { NomeInvalido } from '../src/shared/erros'
import { validarNome } from '../src/convites/nome'

describe('validarNome', () => {
  it('aceita nome simples e devolve trimado', () => {
    expect(validarNome('  Ana  ')).toBe('Ana')
  })

  it('aceita o limite de 1 caractere', () => {
    expect(validarNome('A')).toBe('A')
  })

  it('aceita o limite de 40 caracteres', () => {
    const nome = 'A'.repeat(40)
    expect(validarNome(nome)).toBe(nome)
  })

  it('rejeita 41 caracteres', () => {
    expect(() => validarNome('A'.repeat(41))).toThrow(NomeInvalido)
  })

  it('rejeita string vazia', () => {
    expect(() => validarNome('')).toThrow(NomeInvalido)
  })

  it('rejeita string só com espaços (vazia após trim)', () => {
    expect(() => validarNome('    ')).toThrow(NomeInvalido)
  })

  it('rejeita tipos que não são string', () => {
    expect(() => validarNome(undefined)).toThrow(NomeInvalido)
    expect(() => validarNome(null)).toThrow(NomeInvalido)
    expect(() => validarNome(42)).toThrow(NomeInvalido)
    expect(() => validarNome(['Ana'])).toThrow(NomeInvalido)
  })
})
