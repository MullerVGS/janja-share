import { afterEach, describe, expect, it } from 'vitest'
import { guardarCaptura, retirarCaptura } from '../src/sala/capturaPendente'

const FAIXA = { kind: 'video' } as never

afterEach(() => retirarCaptura())

describe('captura pendente: a entrega entre a home e a sala', () => {
  it('sem nada guardado, retirar devolve null', () => {
    expect(retirarCaptura()).toBeNull()
  })

  it('o que foi guardado sai inteiro', () => {
    guardarCaptura([FAIXA])
    expect(retirarCaptura()).toEqual([FAIXA])
  })

  it('retirar é destrutivo: a segunda chamada não repete a entrega', () => {
    guardarCaptura([FAIXA])
    retirarCaptura()
    expect(retirarCaptura()).toBeNull()
  })
})
