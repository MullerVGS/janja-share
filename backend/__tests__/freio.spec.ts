import { Freio } from '../src/shared/freio'

describe('Freio — janela deslizante com relógio injetado', () => {
  it('permite até o limite e recusa no pedido seguinte', () => {
    let agora = 0
    const freio = new Freio(() => agora)

    expect(freio.permite('ip-1', 3, 1000)).toBe(true)
    expect(freio.permite('ip-1', 3, 1000)).toBe(true)
    expect(freio.permite('ip-1', 3, 1000)).toBe(true)
    expect(freio.permite('ip-1', 3, 1000)).toBe(false)
  })

  it('libera depois que a janela passa', () => {
    let agora = 0
    const freio = new Freio(() => agora)

    expect(freio.permite('ip-1', 2, 1000)).toBe(true)
    expect(freio.permite('ip-1', 2, 1000)).toBe(true)
    expect(freio.permite('ip-1', 2, 1000)).toBe(false)

    agora = 1001 // a primeira tentativa (t=0) já saiu da janela [1001-1000, 1001] = (1, 1001]
    expect(freio.permite('ip-1', 2, 1000)).toBe(true)
  })

  it('a janela desliza: um pedido antigo sai do histórico sem esperar a janela toda passar de novo', () => {
    let agora = 0
    const freio = new Freio(() => agora)

    expect(freio.permite('ip-1', 1, 1000)).toBe(true) // t=0, ocupa o único slot

    agora = 500
    expect(freio.permite('ip-1', 1, 1000)).toBe(false) // t=0 ainda dentro da janela [−500, 500]

    agora = 1001 // t=0 já saiu da janela (0 não é > 1001-1000=1)
    expect(freio.permite('ip-1', 1, 1000)).toBe(true)
  })

  it('chaves independentes: o limite de uma chave não afeta a outra', () => {
    let agora = 0
    const freio = new Freio(() => agora)

    expect(freio.permite('ip-1', 1, 1000)).toBe(true)
    expect(freio.permite('ip-1', 1, 1000)).toBe(false)
    expect(freio.permite('ip-2', 1, 1000)).toBe(true)
  })

  it('sem relógio injetado, usa Date.now (relógio real) por padrão', () => {
    const freio = new Freio()
    expect(freio.permite('ip-1', 5, 1000)).toBe(true)
  })
})
