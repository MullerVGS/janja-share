import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { Peca } from './palco'
import { ZOOM_INICIAL, aplicarGesto, type Gesto, type Medidas, type Zoom } from './zoom'

/**
 * O zoom de cada peça do palco, e os gestos que mexem nele.
 *
 * `zoom.ts` é a matemática pura; aqui mora o que ela não pode saber: qual peça está sendo
 * olhada, quanto mede o quadro no DOM e que tamanho o vídeo declarou.
 */
export interface ControleDeZoom {
  de(chave: string): Zoom
  /** Estável entre renders: dá para amarrá-la a um ouvinte sem recriá-lo a cada gesto. */
  aplicar(chave: string, gesto: Gesto, medidas: Medidas): void
}

/**
 * O zoom é por peça e morre com ela: sem podar, cada tela que entra e sai deixaria um estado
 * para trás, e a memória cresceria pelo simples uso da sala.
 */
function podar(zooms: Record<string, Zoom>, pecas: readonly Peca[]): Record<string, Zoom> {
  const vivas = new Set(pecas.map((peca) => peca.chave))
  const sumidas = Object.keys(zooms).filter((chave) => !vivas.has(chave))
  if (sumidas.length === 0) return zooms // mesma referência: nada a re-renderizar
  const podado = { ...zooms }
  for (const chave of sumidas) delete podado[chave]
  return podado
}

export function useZoom(pecas: readonly Peca[]): ControleDeZoom {
  const [zooms, setZooms] = useState<Record<string, Zoom>>({})

  useEffect(() => {
    setZooms((atuais) => podar(atuais, pecas))
  }, [pecas])

  const aplicar = useCallback((chave: string, gesto: Gesto, medidas: Medidas) => {
    setZooms((atuais) => {
      const antes = atuais[chave] ?? ZOOM_INICIAL
      const depois = aplicarGesto(antes, gesto, medidas)
      return depois === antes ? atuais : { ...atuais, [chave]: depois }
    })
  }, [])

  return useMemo(() => ({ de: (chave: string) => zooms[chave] ?? ZOOM_INICIAL, aplicar }), [zooms, aplicar])
}

/** As medidas que `aplicarGesto` pede, lidas do DOM na hora do gesto. */
function medir(moldura: HTMLElement, video: HTMLVideoElement | null): Medidas {
  const area = moldura.getBoundingClientRect()
  return {
    quadro: { largura: area.width, altura: area.height },
    // Antes dos metadados do vídeo isto é 0 × 0, e `aplicarGesto` já devolve o zoom intacto.
    imagem: { largura: video?.videoWidth ?? 0, altura: video?.videoHeight ?? 0 },
  }
}

interface Gestos {
  moldura: RefObject<HTMLElement | null>
  video: RefObject<HTMLVideoElement | null>
  /** Só em foco e em tela cheia: na grade aproximar uma miniatura seria gesto sem propósito. */
  ativo: boolean
  aoGesto(gesto: Gesto, medidas: Medidas): void
}

/**
 * A roda e o arraste do quadro.
 *
 * O `wheel` é registrado à mão com `{ passive: false }`: `onWheel` no JSX entra passivo em
 * alguns caminhos do React 19, e um ouvinte passivo ignora `preventDefault` — a página rolaria
 * atrás da imagem a cada aproximação.
 */
export function useGestosDoZoom({ moldura, video, ativo, aoGesto }: Gestos) {
  // O ouvinte não passivo é registrado uma vez por quadro; ler o gesto de uma referência é o que
  // impede que ele seja desmontado e remontado a cada volta da roda.
  const ultimoGesto = useRef(aoGesto)
  useEffect(() => {
    ultimoGesto.current = aoGesto
  })

  useEffect(() => {
    const elemento = moldura.current
    if (!elemento || !ativo) return

    const aoGirar = (evento: WheelEvent) => {
      evento.preventDefault()
      const area = elemento.getBoundingClientRect()
      ultimoGesto.current(
        {
          tipo: 'roda',
          delta: evento.deltaY,
          cursor: { x: evento.clientX - area.left, y: evento.clientY - area.top },
        },
        medir(elemento, video.current),
      )
    }

    elemento.addEventListener('wheel', aoGirar, { passive: false })
    return () => elemento.removeEventListener('wheel', aoGirar)
  }, [moldura, video, ativo])

  const de = useRef<{ ponteiro: number; x: number; y: number } | null>(null)

  return {
    /** Um gesto que não vem do ponteiro — os botões `caber` e `1:1` da pílula. */
    disparar(gesto: Gesto) {
      const elemento = moldura.current
      if (!elemento) return
      ultimoGesto.current(gesto, medir(elemento, video.current))
    },
    /** Os ouvintes do arraste, para espalhar no elemento da imagem. */
    ponteiro: {
      onPointerDown(evento: PointerEvent<HTMLElement>) {
        if (!ativo) return
        // Capturar o ponteiro é o que deixa a mão sair do quadro sem largar a imagem no meio.
        evento.currentTarget.setPointerCapture?.(evento.pointerId)
        de.current = { ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY }
      },
      onPointerMove(evento: PointerEvent<HTMLElement>) {
        const inicio = de.current
        const elemento = moldura.current
        if (!inicio || inicio.ponteiro !== evento.pointerId || !elemento) return
        ultimoGesto.current(
          { tipo: 'arraste', dx: evento.clientX - inicio.x, dy: evento.clientY - inicio.y },
          medir(elemento, video.current),
        )
        de.current = { ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY }
      },
      onPointerUp(evento: PointerEvent<HTMLElement>) {
        if (de.current?.ponteiro !== evento.pointerId) return
        de.current = null
        evento.currentTarget.releasePointerCapture?.(evento.pointerId)
      },
      onPointerCancel(evento: PointerEvent<HTMLElement>) {
        if (de.current?.ponteiro === evento.pointerId) de.current = null
      },
    },
  }
}
