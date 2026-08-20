import { useEffect, useRef, type PointerEvent } from 'react'

const JANELA_DO_CLIQUE_MS = 250
const LIMIAR_DE_ARRASTE_PX = 5

/**
 * Separa clique de duplo clique e ignora arraste — o par do arraste do zoom
 * (`sala/useZoom.ts`) para o outro lado do gesto: aqui o ponteiro não anda, só bate.
 *
 * O clique espera a janela inteira antes de agir, porque só assim dá para saber se não vem um
 * segundo bate logo atrás virando duplo clique.
 */
export function useCliqueOuDuplo(aoClicar: () => void, aoClicarDuplo: () => void) {
  const partida = useRef<{ ponteiro: number; x: number; y: number } | null>(null)
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Um clique pendente não pode disparar num componente já desmontado.
  useEffect(() => {
    return () => {
      if (pendente.current !== null) clearTimeout(pendente.current)
    }
  }, [])

  return {
    onPointerDown(evento: PointerEvent<HTMLElement>) {
      partida.current = { ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY }
    },
    onPointerUp(evento: PointerEvent<HTMLElement>) {
      const inicio = partida.current
      partida.current = null
      if (!inicio || inicio.ponteiro !== evento.pointerId) return

      const deslocamento = Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y)
      if (deslocamento > LIMIAR_DE_ARRASTE_PX) return // arraste, não clique

      if (pendente.current !== null) {
        clearTimeout(pendente.current)
        pendente.current = null
        aoClicarDuplo()
        return
      }

      pendente.current = setTimeout(() => {
        pendente.current = null
        aoClicar()
      }, JANELA_DO_CLIQUE_MS)
    },
  }
}
