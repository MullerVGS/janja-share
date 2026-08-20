import { cifrar, confere } from '../src/shared/senha'

describe('cifrar/confere', () => {
  it('ida e volta: a senha certa confere', () => {
    const guardado = cifrar('correcthorsebatterystaple')
    expect(confere('correcthorsebatterystaple', guardado)).toBe(true)
  })

  it('senha errada não confere', () => {
    const guardado = cifrar('correcthorsebatterystaple')
    expect(confere('senha-errada', guardado)).toBe(false)
  })

  it('duas cifragens da mesma senha usam salts diferentes (guardado nunca é igual)', () => {
    const a = cifrar('mesma-senha')
    const b = cifrar('mesma-senha')
    expect(a).not.toBe(b)
    expect(confere('mesma-senha', a)).toBe(true)
    expect(confere('mesma-senha', b)).toBe(true)
  })

  it('formato guardado é "salt:hash" em hex', () => {
    const guardado = cifrar('teste')
    const partes = guardado.split(':')
    expect(partes).toHaveLength(2)
    expect(partes[0]).toMatch(/^[0-9a-f]{32}$/) // salt de 16 bytes = 32 hex
    expect(partes[1]).toMatch(/^[0-9a-f]{64}$/) // saída de 32 bytes = 64 hex
  })

  it('guardado malformado devolve false, nunca lança', () => {
    expect(confere('qualquer', '')).toBe(false)
    expect(confere('qualquer', 'sem-dois-pontos')).toBe(false)
    expect(confere('qualquer', 'a:b:c')).toBe(false)
    expect(confere('qualquer', 'zzzz:zzzz')).toBe(false) // não é hex
    expect(confere('qualquer', ':')).toBe(false)
    expect(confere('qualquer', 'aabb:')).toBe(false)
  })

  it('senha vazia também cifra e confere', () => {
    const guardado = cifrar('')
    expect(confere('', guardado)).toBe(true)
    expect(confere('nao-vazia', guardado)).toBe(false)
  })
})
