import { cifrar, confere } from '../src/shared/senha'

describe('cifrar/confere', () => {
  it('ida e volta: a senha certa confere', async () => {
    const guardado = await cifrar('correcthorsebatterystaple')
    await expect(confere('correcthorsebatterystaple', guardado)).resolves.toBe(true)
  })

  it('senha errada não confere', async () => {
    const guardado = await cifrar('correcthorsebatterystaple')
    await expect(confere('senha-errada', guardado)).resolves.toBe(false)
  })

  it('duas cifragens da mesma senha usam salts diferentes (guardado nunca é igual)', async () => {
    const a = await cifrar('mesma-senha')
    const b = await cifrar('mesma-senha')
    expect(a).not.toBe(b)
    await expect(confere('mesma-senha', a)).resolves.toBe(true)
    await expect(confere('mesma-senha', b)).resolves.toBe(true)
  })

  it('formato guardado é "salt:hash" em hex', async () => {
    const guardado = await cifrar('teste')
    const partes = guardado.split(':')
    expect(partes).toHaveLength(2)
    expect(partes[0]).toMatch(/^[0-9a-f]{32}$/) // salt de 16 bytes = 32 hex
    expect(partes[1]).toMatch(/^[0-9a-f]{64}$/) // saída de 32 bytes = 64 hex
  })

  it('guardado malformado devolve false, nunca lança', async () => {
    await expect(confere('qualquer', '')).resolves.toBe(false)
    await expect(confere('qualquer', 'sem-dois-pontos')).resolves.toBe(false)
    await expect(confere('qualquer', 'a:b:c')).resolves.toBe(false)
    await expect(confere('qualquer', 'zzzz:zzzz')).resolves.toBe(false) // não é hex
    await expect(confere('qualquer', ':')).resolves.toBe(false)
    await expect(confere('qualquer', 'aabb:')).resolves.toBe(false)
  })

  it('senha vazia também cifra e confere', async () => {
    const guardado = await cifrar('')
    await expect(confere('', guardado)).resolves.toBe(true)
    await expect(confere('nao-vazia', guardado)).resolves.toBe(false)
  })

  it('não trava o event loop: um timer de 0ms dispara antes de scrypt terminar', async () => {
    let timerDisparou = false
    setTimeout(() => {
      timerDisparou = true
    }, 0)
    await cifrar('senha-qualquer')
    expect(timerDisparou).toBe(true)
  })
})
