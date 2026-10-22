import { afterEach, describe, expect, it } from 'vitest'
import {
  enderecoDaSala,
  fraseDaGuarda,
  lerCargaDaAssinatura,
  palpiteDoSlug,
} from '../src/salas/link'
import {
  CHAVE_DAS_SUAS_SALAS,
  esquecerSala,
  LIMITE_DE_SUAS_SALAS,
  lembrarSala,
  lerSuasSalas,
  salaLembrada,
} from '../src/salas/suasSalas'
import { assinaturaFalsa } from './apoio/assinaturaFalsa'

afterEach(() => localStorage.clear())

describe('link da sala', () => {
  it('a Sala fixa leva a assinatura no `?k=`; a efêmera, não', () => {
    expect(enderecoDaSala('eclipse', 'abc.def')).toBe('/sala/eclipse?k=abc.def')
    expect(enderecoDaSala('eclipse', null)).toBe('/sala/eclipse')
  })

  it('a frase do prazo é uma só para cada tipo', () => {
    expect(fraseDaGuarda(true)).toBe('Fica guardada por 7 dias depois que todos saírem.')
    expect(fraseDaGuarda(false)).toBe('Some quando todos saírem.')
  })

  it('lê nome, visibilidade e validade da carga — com acento e emoji no nome', () => {
    const ate = Date.UTC(2026, 9, 29, 12)
    expect(lerCargaDaAssinatura(assinaturaFalsa('Sessão ☕', true, ate))).toEqual({
      nome: 'Sessão ☕',
      privada: true,
      ate,
    })
  })

  it('carga que não é a do formato vira null, sem lançar', () => {
    for (const ruim of [undefined, null, '', 'lixo', '.mac', 'bm9wZQ.mac', `${btoa('[1,2]')}.mac`]) {
      expect(lerCargaDaAssinatura(ruim)).toBeNull()
    }
  })

  it('o palpite do slug tira o sufixo da privada e devolve espaços', () => {
    expect(palpiteDoSlug('eclipse-3')).toEqual({ nome: 'Eclipse 3', privada: false })
    expect(palpiteDoSlug('cafe-da-noite-7f3a91')).toEqual({ nome: 'Cafe da noite', privada: true })
  })
})

describe('suas salas', () => {
  const eclipse = { slug: 'eclipse', nome: 'Eclipse', privada: false, assinatura: 'a.b' }

  it('lembrar põe no topo, e lembrar de novo não duplica', () => {
    lembrarSala(eclipse, undefined, 1000)
    lembrarSala({ ...eclipse, slug: 'lua', nome: 'Lua' }, undefined, 2000)
    lembrarSala({ ...eclipse, assinatura: 'c.d' }, undefined, 3000)

    expect(lerSuasSalas(3000).map((sala) => [sala.slug, sala.assinatura])).toEqual([
      ['eclipse', 'c.d'],
      ['lua', 'a.b'],
    ])
  })

  it('a Sala que mudou de nome substitui o item antigo', () => {
    lembrarSala(eclipse, undefined, 1000)
    lembrarSala({ ...eclipse, slug: 'lua', nome: 'Lua' }, 'eclipse', 2000)

    expect(lerSuasSalas(2000).map((sala) => sala.slug)).toEqual(['lua'])
  })

  it('guarda no máximo o limite, e a mais antiga sai', () => {
    for (let i = 0; i <= LIMITE_DE_SUAS_SALAS; i++) lembrarSala({ ...eclipse, slug: `s-${i}` }, undefined, 1000 + i)

    const salas = lerSuasSalas(5000)
    expect(salas).toHaveLength(LIMITE_DE_SUAS_SALAS)
    expect(salas.some((sala) => sala.slug === 's-0')).toBe(false)
  })

  it('esquece depois de 30 dias e quando a pessoa tira da lista', () => {
    lembrarSala(eclipse, undefined, 0)
    expect(lerSuasSalas(31 * 24 * 60 * 60 * 1000)).toEqual([])

    lembrarSala(eclipse)
    expect(salaLembrada('eclipse')).not.toBeNull()
    esquecerSala('eclipse')
    expect(salaLembrada('eclipse')).toBeNull()
  })

  it('leitura tolerante: item estranho sai, versão errada ou JSON quebrado viram lista vazia', () => {
    localStorage.setItem(
      CHAVE_DAS_SUAS_SALAS,
      JSON.stringify({ versao: 1, salas: [{ ...eclipse, em: Date.now() }, { slug: 3 }] }),
    )
    expect(lerSuasSalas().map((sala) => sala.slug)).toEqual(['eclipse'])

    localStorage.setItem(CHAVE_DAS_SUAS_SALAS, JSON.stringify({ versao: 9, salas: [] }))
    expect(lerSuasSalas()).toEqual([])

    localStorage.setItem(CHAVE_DAS_SUAS_SALAS, '{')
    expect(lerSuasSalas()).toEqual([])
  })
})
