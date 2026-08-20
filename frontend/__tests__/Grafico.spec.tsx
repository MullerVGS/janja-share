import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Grafico } from '../src/ui/Grafico'

function montarGrafico() {
  return render(
    <Grafico
      titulo="FPS"
      series={[
        { nome: 'codificado', valores: [28, 29, null, 30], cor: 'menta', destaque: true },
        { nome: 'captura', valores: [30, 30, 30, 30], cor: 'lilas' },
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
