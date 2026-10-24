import { describe, expect, it } from 'vitest'
import { foraDeVista, type Vista } from '../src/sala/aVista'

const FOCO_NA_BIA: Vista = { foco: 'bia', pilhaVisivel: false, abaVisivel: true, janelinha: false }

describe('a Tela que ninguém está vendo', () => {
  it('a Tela em foco está à vista; as da pilha escondida não', () => {
    expect(foraDeVista('bia', FOCO_NA_BIA)).toBeNull()
    expect(foraDeVista('caio', FOCO_NA_BIA)).toBe('pilha')
  })

  it('a pilha à mostra traz as miniaturas de volta', () => {
    expect(foraDeVista('caio', { ...FOCO_NA_BIA, pilhaVisivel: true })).toBeNull()
  })

  it('na grade todos os quadros estão à vista', () => {
    expect(foraDeVista('caio', { ...FOCO_NA_BIA, foco: null })).toBeNull()
  })

  it('a aba escondida tira tudo de vista, também a grade e a pilha à mostra', () => {
    const atras = { ...FOCO_NA_BIA, abaVisivel: false, pilhaVisivel: true }
    expect(foraDeVista('bia', atras)).toBe('aba')
    expect(foraDeVista('caio', atras)).toBe('aba')
    expect(foraDeVista('caio', { ...atras, foco: null })).toBe('aba')
  })

  it('a janelinha segura a Tela em foco com a aba escondida, e só ela', () => {
    const naJanelinha = { ...FOCO_NA_BIA, abaVisivel: false, janelinha: true }
    expect(foraDeVista('bia', naJanelinha)).toBeNull()
    expect(foraDeVista('caio', naJanelinha)).toBe('aba')
  })
})
