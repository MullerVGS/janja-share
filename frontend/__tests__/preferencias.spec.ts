import { afterEach, describe, expect, it } from 'vitest'
import {
  CHAVE_DAS_PREFERENCIAS,
  gravarPreferencias,
  lerPreferencias,
  PREFERENCIAS_PADRAO,
} from '../src/preferencias'

afterEach(() => localStorage.clear())

describe('preferências', () => {
  it('sem nada guardado, devolve os padrões', () => {
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO)
  })

  it('gravar funde com o que já existe e devolve o conjunto inteiro', () => {
    gravarPreferencias({ larguraDaLateral: 420 })
    expect(gravarPreferencias({ abaDaLateral: 'transmissao' })).toEqual({
      ...PREFERENCIAS_PADRAO,
      larguraDaLateral: 420,
      abaDaLateral: 'transmissao',
    })
    expect(lerPreferencias().larguraDaLateral).toBe(420)
  })

  it('o que vai ao disco é um único objeto versionado', () => {
    gravarPreferencias({ larguraDaLateral: 360 })
    const cru = JSON.parse(localStorage.getItem(CHAVE_DAS_PREFERENCIAS) ?? 'null') as Record<string, unknown>
    expect(cru.versao).toBe(1)
    expect(cru.larguraDaLateral).toBe(360)
  })

  it('lixo no disco vira padrão, sem explodir', () => {
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, '{{{')
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO)
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, '[1,2]')
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO)
  })

  it('versão velha vira padrão inteiro', () => {
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 0, larguraDaLateral: 500 }))
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO)
  })

  it('campo inválido vira o padrão daquele campo; os demais ficam', () => {
    localStorage.setItem(
      CHAVE_DAS_PREFERENCIAS,
      JSON.stringify({ versao: 1, larguraDaLateral: 'larga', abaDaLateral: 'chat' }),
    )
    expect(lerPreferencias()).toEqual({ ...PREFERENCIAS_PADRAO, abaDaLateral: 'chat' })

    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, larguraDaLateral: 380, abaDaLateral: 'sótão' }))
    expect(lerPreferencias()).toEqual({ ...PREFERENCIAS_PADRAO, larguraDaLateral: 380 })
  })
})
