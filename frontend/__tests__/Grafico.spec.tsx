import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Grafico } from '../src/ui/Grafico'

function montarGrafico() {
  return render(
    <Grafico
      titulo="FPS"
      series={[
        { nome: 'codificado', valores: [28, 29, null, 30], cor: 'acao', destaque: true },
        { nome: 'captura', valores: [30, 30, 30, 30], cor: 'apoio' },
      ]}
      referencias={[{ nome: 'alvo', valor: 30 }]}
      faixas={[{ inicio: 1, fim: 2, motivo: 'cpu' }]}
      piso={60}
      formatar={(valor) => `${valor} fps`}
    />,
  )
}

describe('gráfico', () => {
  it('mostra o título, o valor atual da série em destaque e a legenda com séries e referências', () => {
    const { container } = montarGrafico()
    expect(screen.getByRole('img', { name: 'FPS' })).toBeInTheDocument()
    expect(container.querySelector('figcaption')).toHaveTextContent(/^FPS30 fps$/)
    const legenda = screen.getByRole('list')
    expect(legenda).toHaveTextContent('codificado')
    expect(legenda).toHaveTextContent('captura')
    expect(legenda).toHaveTextContent('alvo 30 fps')
  })

  it('pinta faixas de fundo por motivo e desenha uma linha por série', () => {
    const { container } = montarGrafico()
    expect(container.querySelector('rect[data-motivo="cpu"]')).not.toBeNull()
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('marca, com uma linha vertical, cada amostra em que o governador agiu', () => {
    const { container } = render(
      <Grafico
        titulo="FPS"
        series={[{ nome: 'codificado', valores: [30, 30, 15, 15], cor: 'acao' }]}
        marcas={[{ indice: 2, rotulo: '60 → 15 fps' }]}
        formatar={(valor) => `${valor} fps`}
      />,
    )
    const marca = container.querySelector('line[data-marca]')
    expect(marca).not.toBeNull()
    expect(marca?.querySelector('title')).toHaveTextContent('60 → 15 fps')
  })

  it('sob o ponteiro, lê todas as séries naquele instante; buraco aparece como travessão', () => {
    const { container } = montarGrafico()
    const svg = container.querySelector('svg') as SVGSVGElement
    svg.getBoundingClientRect = () => ({ left: 0, width: 1190, top: 0, height: 96 } as DOMRect)

    // 4 amostras em 120 slots: a terceira (índice 2) está no slot 118 → x = 118/119 da largura.
    fireEvent.pointerMove(svg, { clientX: (118 / 119) * 1190 })
    const cabecalho = container.querySelector('figcaption')
    expect(cabecalho).toHaveTextContent('— codificado')
    expect(cabecalho).toHaveTextContent('30 fps captura')

    fireEvent.pointerLeave(svg)
    expect(cabecalho).toHaveTextContent(/^FPS30 fps$/)
  })
})

describe('referência fora do eixo', () => {
  function montarComTeto(teto: number) {
    return render(
      <Grafico
        titulo="Bitrate"
        series={[
          { nome: 'saindo', valores: [1000, 1200], cor: 'acao', destaque: true },
          { nome: 'disponível', valores: [1500, 1600], cor: 'apoio' },
        ]}
        referencias={[{ nome: 'teto', valor: teto, foraDoEixo: true }]}
        formatar={(valor) => `${valor}`}
      />,
    )
  }

  it('não manda no domínio: o eixo é das séries e a marca do teto cola no topo', () => {
    const { container } = montarComTeto(50_000)

    const eixo = [...container.querySelectorAll('span[style]')].map((span) => span.textContent)
    expect(eixo).toEqual(['1000', '2000']) // tetoRedondo(1600), não tetoRedondo(50 000)
    const teto = container.querySelector('line[data-grampeada]')
    expect(teto).not.toBeNull()
    expect(teto?.getAttribute('y1')).toBe('0')
    // As duas séries continuam desenhadas dentro do eixo — nenhuma foi grampeada no topo.
    const linhas = [...container.querySelectorAll('path')].map((linha) => linha.getAttribute('d'))
    expect(linhas.every((d) => d?.includes(' 0L'))).toBe(false)
    // O número de verdade não se perde: ele fica na legenda.
    expect(screen.getByRole('list')).toHaveTextContent('teto 50000')
  })

  it('a escala não se move quando o teto sobe — é isso que faz a série encolher na tela', () => {
    const { container, rerender } = montarComTeto(4000)
    const antes = [...container.querySelectorAll('span[style]')].map((span) => span.textContent)

    rerender(
      <Grafico
        titulo="Bitrate"
        series={[
          { nome: 'saindo', valores: [1000, 1200], cor: 'acao', destaque: true },
          { nome: 'disponível', valores: [1500, 1600], cor: 'apoio' },
        ]}
        referencias={[{ nome: 'teto', valor: 12_000, foraDoEixo: true }]}
        formatar={(valor) => `${valor}`}
      />,
    )

    expect([...container.querySelectorAll('span[style]')].map((span) => span.textContent)).toEqual(antes)
  })

  it('referência que cabe no domínio continua sendo linha de verdade, não grampeada', () => {
    const { container } = montarComTeto(1200)
    expect(container.querySelector('line[data-grampeada]')).toBeNull()
  })
})
