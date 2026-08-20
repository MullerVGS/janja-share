import { NomeDaSalaInvalido } from '../src/shared/erros'
import { slugDaSala, validarNomeDaSala } from '../src/shared/slug'

describe('slugDaSala', () => {
  it('coloca em minúsculas', () => {
    expect(slugDaSala('Jogatina')).toBe('jogatina')
  })

  it('remove acentos', () => {
    expect(slugDaSala('José André')).toBe('jose-andre')
  })

  it('espaços e sublinhados viram hífen', () => {
    expect(slugDaSala('sala de estar_dos_amigos')).toBe('sala-de-estar-dos-amigos')
  })

  it('remove tudo que não é [a-z0-9-] sem virar hífen', () => {
    expect(slugDaSala('a!!b??c')).toBe('abc')
  })

  it('colapsa hífens repetidos', () => {
    expect(slugDaSala('a---b')).toBe('a-b')
  })

  it('apara hífens nas pontas', () => {
    expect(slugDaSala('-Jogatina-')).toBe('jogatina')
  })

  it('trunca em 32 caracteres, sem deixar hífen pendurado bem no corte', () => {
    // O hífen cai exatamente na posição 31 (0-based) — cortar em 32 exporia um hífen pendurado
    // se não houvesse um segundo trim depois da truncagem.
    const nome = 'a'.repeat(31) + ' ' + 'b'.repeat(10)
    const resultado = slugDaSala(nome)
    expect(resultado).toBe('a'.repeat(31))
    expect(resultado.length).toBeLessThanOrEqual(32)
  })

  it('trunca nome longo sem cair em hífen, mantendo os 32 caracteres', () => {
    const resultado = slugDaSala('b'.repeat(40))
    expect(resultado).toBe('b'.repeat(32))
  })

  it('nome só de emoji vira slug vazio (quem decide se é erro é validarNomeDaSala)', () => {
    expect(slugDaSala('😀😀')).toBe('')
  })
})

describe('validarNomeDaSala', () => {
  it('aceita nome simples e devolve trimado', () => {
    expect(validarNomeDaSala('  Jogatina  ')).toBe('Jogatina')
  })

  it('aceita o limite de 1 caractere', () => {
    expect(validarNomeDaSala('A')).toBe('A')
  })

  it('aceita o limite de 40 caracteres', () => {
    const nome = 'A'.repeat(40)
    expect(validarNomeDaSala(nome)).toBe(nome)
  })

  it('rejeita 41 caracteres', () => {
    expect(() => validarNomeDaSala('A'.repeat(41))).toThrow(NomeDaSalaInvalido)
  })

  it('rejeita string vazia', () => {
    expect(() => validarNomeDaSala('')).toThrow(NomeDaSalaInvalido)
  })

  it('rejeita string só com espaços (vazia após trim)', () => {
    expect(() => validarNomeDaSala('    ')).toThrow(NomeDaSalaInvalido)
  })

  it('rejeita tipos que não são string', () => {
    expect(() => validarNomeDaSala(undefined)).toThrow(NomeDaSalaInvalido)
    expect(() => validarNomeDaSala(null)).toThrow(NomeDaSalaInvalido)
    expect(() => validarNomeDaSala(42)).toThrow(NomeDaSalaInvalido)
  })

  // Nome só de emoji tem 1..40 caracteres, mas o
  // slug sai vazio — é nome_da_sala_invalido, não "sem nome" e não nome_invalido (esse é o
  // código da pessoa, não da sala).
  it('nome só de emoji: 1..40 chars mas slug vazio → NomeDaSalaInvalido', () => {
    expect(() => validarNomeDaSala('🎮')).toThrow(NomeDaSalaInvalido)
  })

  it('nome só de pontuação: mesmo caso — slug vazio → NomeDaSalaInvalido', () => {
    expect(() => validarNomeDaSala('!!!')).toThrow(NomeDaSalaInvalido)
  })
})
