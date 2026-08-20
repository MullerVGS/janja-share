import { act, fireEvent, render, screen } from '@testing-library/react'
import { useCallback, useRef } from 'react'
import { describe, expect, it } from 'vitest'
import type { Peca } from '../src/sala/palco'
import { useGestosDoZoom, useZoom, type ControleDeZoom } from '../src/sala/useZoom'

function peca(chave: string): Peca {
  return {
    chave,
    identidade: chave,
    nome: chave,
    ehTela: true,
    proprio: false,
    microfoneLigado: false,
    falando: false,
    temAudio: false,
  }
}

/** O quadro reduzido ao que o zoom precisa: uma moldura medida e um vídeo com metadados. */
function Quadrinho({ chave, zoom, ativo }: { chave: string; zoom: ControleDeZoom; ativo: boolean }) {
  const moldura = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const aoGesto = useCallback<Parameters<typeof useGestosDoZoom>[0]['aoGesto']>(
    (gesto, medidas) => zoom.aplicar(chave, gesto, medidas),
    [zoom, chave],
  )
  const gestos = useGestosDoZoom({ moldura, video, ativo, aoGesto })
  const { escala, x, y } = zoom.de(chave)

  return (
    <div ref={moldura} data-testid={chave} data-zoom={`${escala.toFixed(3)} ${Math.round(x)} ${Math.round(y)}`} {...gestos.ponteiro}>
      <video ref={video} />
    </div>
  )
}

function Cenario({ pecas, ativo = true }: { pecas: Peca[]; ativo?: boolean }) {
  const zoom = useZoom(pecas)
  return (
    <>
      {pecas.map((uma) => (
        <Quadrinho key={uma.chave} chave={uma.chave} zoom={zoom} ativo={ativo} />
      ))}
    </>
  )
}

const QUADRO = { largura: 1000, altura: 500 }
const IMAGEM = { largura: 1000, altura: 500 }

/** O jsdom não mede nada: quem responde pelo tamanho do quadro e da imagem é o teste. */
function medir(chave: string) {
  const moldura = screen.getByTestId(chave)
  moldura.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: QUADRO.largura, height: QUADRO.altura }) as DOMRect
  const video = moldura.querySelector('video') as HTMLVideoElement
  Object.defineProperty(video, 'videoWidth', { value: IMAGEM.largura, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: IMAGEM.altura, configurable: true })
  return moldura
}

function girar(moldura: HTMLElement, deltaY: number, cursor = { x: 500, y: 250 }): WheelEvent {
  const evento = new WheelEvent('wheel', { deltaY, clientX: cursor.x, clientY: cursor.y, bubbles: true, cancelable: true })
  act(() => {
    moldura.dispatchEvent(evento)
  })
  return evento
}

function zoomDe(chave: string): string {
  return screen.getByTestId(chave).getAttribute('data-zoom') ?? ''
}

describe('useZoom: a roda', () => {
  it('aproxima e afasta, e dá preventDefault — o palco não rola atrás da imagem', () => {
    render(<Cenario pecas={[peca('tela:a')]} />)
    const moldura = medir('tela:a')
    expect(zoomDe('tela:a')).toBe('1.000 0 0')

    const aproximou = girar(moldura, -100)
    expect(aproximou.defaultPrevented).toBe(true)
    expect(zoomDe('tela:a')).toBe('1.100 0 0')

    girar(moldura, 100)
    expect(zoomDe('tela:a')).toBe('1.000 0 0')
  })

  it('na grade a roda não faz nada e não atrapalha a rolagem da página', () => {
    render(<Cenario pecas={[peca('tela:a')]} ativo={false} />)
    const moldura = medir('tela:a')

    const evento = girar(moldura, -100)

    expect(evento.defaultPrevented).toBe(false)
    expect(zoomDe('tela:a')).toBe('1.000 0 0')
  })
})

describe('useZoom: um zoom por peça', () => {
  it('aproximar uma tela não mexe na outra', () => {
    render(<Cenario pecas={[peca('tela:a'), peca('tela:b')]} />)
    medir('tela:b')

    girar(medir('tela:a'), -100)

    expect(zoomDe('tela:a')).toBe('1.100 0 0')
    expect(zoomDe('tela:b')).toBe('1.000 0 0')
  })

  it('a peça que sai do palco leva o zoom junto — ela volta no encaixe, não onde parou', () => {
    const { rerender } = render(<Cenario pecas={[peca('tela:a'), peca('tela:b')]} />)
    girar(medir('tela:a'), -100)
    expect(zoomDe('tela:a')).toBe('1.100 0 0')

    rerender(<Cenario pecas={[peca('tela:b')]} />)
    rerender(<Cenario pecas={[peca('tela:a'), peca('tela:b')]} />)

    expect(zoomDe('tela:a')).toBe('1.000 0 0')
  })
})

describe('useZoom: o arraste', () => {
  it('anda pela imagem quando ela é maior que o quadro, e para nas bordas', () => {
    render(<Cenario pecas={[peca('tela:a')]} />)
    const moldura = medir('tela:a')
    girar(moldura, -100)

    fireEvent.pointerDown(moldura, { pointerId: 1, clientX: 500, clientY: 250 })
    fireEvent.pointerMove(moldura, { pointerId: 1, clientX: 520, clientY: 250 })
    expect(zoomDe('tela:a')).toBe('1.100 20 0')

    // Muito além da borda: o deslocamento para no limite (a metade do que sobra da imagem).
    fireEvent.pointerMove(moldura, { pointerId: 1, clientX: 5000, clientY: 250 })
    expect(zoomDe('tela:a')).toBe('1.100 50 0')

    fireEvent.pointerUp(moldura, { pointerId: 1, clientX: 5000, clientY: 250 })
    fireEvent.pointerMove(moldura, { pointerId: 1, clientX: 0, clientY: 250 })
    expect(zoomDe('tela:a')).toBe('1.100 50 0')
  })

  it('na grade o arraste não anda com a imagem', () => {
    render(<Cenario pecas={[peca('tela:a')]} ativo={false} />)
    const moldura = medir('tela:a')

    fireEvent.pointerDown(moldura, { pointerId: 1, clientX: 500, clientY: 250 })
    fireEvent.pointerMove(moldura, { pointerId: 1, clientX: 560, clientY: 250 })

    expect(zoomDe('tela:a')).toBe('1.000 0 0')
  })
})
