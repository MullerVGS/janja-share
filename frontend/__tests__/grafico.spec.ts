import { describe, expect, it } from 'vitest'
import { caminho, dominioY, faixas, marcasY, posicoesX, tetoRedondo, yDe } from '../src/ui/grafico'

describe('escalas do gráfico', () => {
  it('as amostras encostam na direita: a mais nova fica na borda, as que faltam ficam à esquerda', () => {
    expect(posicoesX(3, 5, 400)).toEqual([200, 300, 400])
    expect(posicoesX(5, 5, 400)).toEqual([0, 100, 200, 300, 400])
    expect(posicoesX(0, 5, 400)).toEqual([])
  })

  it('teto redondo: 1, 2, 5 × potência de dez, sempre acima do valor', () => {
    expect(tetoRedondo(0)).toBe(1)
    expect(tetoRedondo(7)).toBe(10)
    expect(tetoRedondo(30)).toBe(50)
    expect(tetoRedondo(60)).toBe(100)
    expect(tetoRedondo(3400)).toBe(5000)
    expect(tetoRedondo(100)).toBe(100)
  })

  it('o domínio Y começa em zero e cobre séries e referências, ignorando buracos', () => {
    expect(dominioY([[10, null, 28]], [30])).toEqual({ minimo: 0, maximo: 50 })
    expect(dominioY([[null, null]], [])).toEqual({ minimo: 0, maximo: 1 })
    expect(dominioY([[1, 2]], [], 60)).toEqual({ minimo: 0, maximo: 60 })
  })

  it('y cresce para cima: o máximo fica no topo (zero px), o mínimo no chão', () => {
    const dominio = { minimo: 0, maximo: 100 }
    expect(yDe(100, dominio, 80)).toBe(0)
    expect(yDe(0, dominio, 80)).toBe(80)
    expect(yDe(25, dominio, 80)).toBe(60)
  })

  it('o caminho quebra nos buracos em vez de ligar pontas falsas', () => {
    const xs = [0, 10, 20, 30]
    expect(caminho([5, 5, null, 5], xs, { minimo: 0, maximo: 10 }, 10)).toBe('M0 5L10 5M30 5')
    expect(caminho([null, null], [0, 10], { minimo: 0, maximo: 10 }, 10)).toBe('')
  })

  it('em degraus, o valor vale até a próxima amostra', () => {
    expect(caminho([2, 2, 6], [0, 10, 20], { minimo: 0, maximo: 10 }, 10, true)).toBe('M0 8L10 8L10 8L20 8L20 4')
  })

  it('faixas: trechos contíguos com o mesmo motivo viram uma faixa só', () => {
    expect(faixas([null, 'cpu', 'cpu', 'banda', null, 'cpu'])).toEqual([
      { inicio: 1, fim: 2, motivo: 'cpu' },
      { inicio: 3, fim: 3, motivo: 'banda' },
      { inicio: 5, fim: 5, motivo: 'cpu' },
    ])
  })

  it('marcas do eixo Y: poucas, redondas, com o topo', () => {
    expect(marcasY({ minimo: 0, maximo: 100 })).toEqual([50, 100])
    expect(marcasY({ minimo: 0, maximo: 5000 })).toEqual([2500, 5000])
  })
})
