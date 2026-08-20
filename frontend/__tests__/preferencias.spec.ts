import { afterEach, describe, expect, it } from 'vitest'
import {
  CHAVE_DAS_PREFERENCIAS,
  gravarPreferencias,
  lerPreferencias,
  PREFERENCIAS_PADRAO,
} from '../src/preferencias'
import { PERFIL_PADRAO, PRESET_DO_CONTEUDO } from '../src/sala/qualidade'

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

  it('o perfil de qualidade e a chave do automático vêm guardados; o padrão é o preset Texto com automático ligado', () => {
    expect(PREFERENCIAS_PADRAO.perfil).toBe(PERFIL_PADRAO)
    expect(PREFERENCIAS_PADRAO.automatico).toBe(true)

    const perfil = { ...PRESET_DO_CONTEUDO.movimento, resolucao: '720p' as const, tetoKbps: 12_000 }
    gravarPreferencias({ perfil, automatico: false })
    expect(lerPreferencias()).toMatchObject({ perfil, automatico: false })
  })

  it('perfil inválido ou de outro vocabulário vira o preset Texto; automático estranho vira ligado', () => {
    localStorage.setItem(
      CHAVE_DAS_PREFERENCIAS,
      JSON.stringify({ versao: 1, perfil: { resolucao: '1080p', fps: 15, prioridade: 'nitidez', tetoKbps: 2500 }, automatico: 'sim' }),
    )
    expect(lerPreferencias()).toMatchObject({ perfil: PERFIL_PADRAO, automatico: true })

    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, perfil: { ...PERFIL_PADRAO, tetoKbps: 999_999 } }))
    expect(lerPreferencias().perfil).toEqual(PERFIL_PADRAO)
  })

  it('os volumes locais vêm guardados por nome; sem nada mexido, o mapa é vazio', () => {
    expect(PREFERENCIAS_PADRAO.volumes).toEqual({})

    gravarPreferencias({ volumes: { Bia: { pessoa: 40, tela: 0 } } })
    expect(lerPreferencias().volumes).toEqual({ Bia: { pessoa: 40, tela: 0 } })
  })

  it('nos volumes, o nome estragado some sozinho — o mapa inteiro não vai junto', () => {
    localStorage.setItem(
      CHAVE_DAS_PREFERENCIAS,
      JSON.stringify({ versao: 1, volumes: { Bia: { tela: 30 }, Caio: { tela: 'alto' } } }),
    )
    expect(lerPreferencias().volumes).toEqual({ Bia: { tela: 30 } })

    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, volumes: 'alto' }))
    expect(lerPreferencias().volumes).toEqual({})
  })

  it('o ajuste das telas fica guardado; o padrão é caber e um valor estranho volta a ele', () => {
    expect(PREFERENCIAS_PADRAO.ajuste).toBe('caber')

    gravarPreferencias({ ajuste: 'pixelAPixel' })
    expect(lerPreferencias().ajuste).toBe('pixelAPixel')

    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, ajuste: 'esticado' }))
    expect(lerPreferencias().ajuste).toBe('caber')
  })

  it('o nome de exibição fica guardado; o padrão é vazio e um valor que não é string volta a ele', () => {
    expect(PREFERENCIAS_PADRAO.nome).toBe('')

    gravarPreferencias({ nome: 'Ana' })
    expect(lerPreferencias().nome).toBe('Ana')

    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, nome: 42 }))
    expect(lerPreferencias().nome).toBe('')
  })
})
