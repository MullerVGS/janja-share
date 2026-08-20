import { useLayoutEffect, useRef, type RefObject } from 'react'

const DURACAO_MS = 190
/** Abaixo disto não houve movimento que valha animar. */
const TOLERANCIA_PX = 1
const TOLERANCIA_DA_ESCALA = 0.01

function semMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Cresce e encolhe a peça na troca entre a grade e o foco.
 *
 * Nem transição nem animação de entrada dão conta: `grid-template-columns` não interpola, e a
 * peça em foco não remonta (mesma chave, mesmo pai) justamente para o vídeo não piscar — então
 * ela saltava de tamanho enquanto as outras cresciam. A técnica é o FLIP: guardar o retângulo
 * de antes, aplicar a transformação que devolve o elemento àquele lugar e animar até a
 * identidade. O layout novo já está no lugar o tempo todo; o que se move é só a pintura, e por
 * isso a origem é o canto superior esquerdo — é o canto que a conta mapeia.
 *
 * `gatilho` é o que define "antes": a medida é refeita quando ele muda, e só aí há animação.
 */
export function useCrescerEEncolher(alvo: RefObject<HTMLElement | null>, gatilho: unknown): void {
  const anterior = useRef<DOMRect | null>(null)

  useLayoutEffect(() => {
    const elemento = alvo.current
    if (!elemento) return

    const agora = elemento.getBoundingClientRect()
    const antes = anterior.current
    anterior.current = agora
    // Sem "antes" (a primeira medida) ou sem medida nenhuma (o jsdom mede zero): nada a animar.
    if (!antes || antes.width === 0 || antes.height === 0 || agora.width === 0 || agora.height === 0) return

    const dx = antes.left - agora.left
    const dy = antes.top - agora.top
    const escalaX = antes.width / agora.width
    const escalaY = antes.height / agora.height
    const parado =
      Math.abs(dx) < TOLERANCIA_PX &&
      Math.abs(dy) < TOLERANCIA_PX &&
      Math.abs(escalaX - 1) < TOLERANCIA_DA_ESCALA &&
      Math.abs(escalaY - 1) < TOLERANCIA_DA_ESCALA
    if (parado || semMovimento()) return

    elemento.animate?.(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${escalaX}, ${escalaY})`, transformOrigin: 'top left' },
        { transform: 'none', transformOrigin: 'top left' },
      ],
      { duration: DURACAO_MS, easing: 'ease' },
    )
  }, [alvo, gatilho])
}
