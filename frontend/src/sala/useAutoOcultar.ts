import { useEffect, useRef, useState } from 'react'

const OCULTAR_DEPOIS_DE_MS = 2500

/**
 * Se a interface flutuante do palco está à mostra. Some depois de 2,5 s sem o ponteiro se
 * mexer; qualquer movimento traz de volta e reinicia a contagem. `travado` (gaveta aberta, menu
 * aberto, foco de teclado dentro) trava visível o tempo todo — ao destravar, o relógio recomeça
 * do zero, não do que sobrava antes da trava.
 *
 * O relógio em si não é estado do React: só a transição visível↔oculto muda `useState`, para o
 * movimento do ponteiro não bater `setState` (e re-render) a cada evento, coisa que aconteceria
 * a até 60 vezes por segundo.
 */
export function useAutoOcultar(travado: boolean): boolean {
  const [visivel, setVisivel] = useState(true)
  const visivelRef = useRef(true)

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null

    function mostrar() {
      if (!visivelRef.current) {
        visivelRef.current = true
        setVisivel(true)
      }
    }

    function ocultar() {
      if (visivelRef.current) {
        visivelRef.current = false
        setVisivel(false)
      }
    }

    // Só é chamado do lado de baixo do `if (travado) return` — travado nunca chega a agendar.
    function reiniciarRelogio() {
      if (temporizador !== null) clearTimeout(temporizador)
      temporizador = setTimeout(ocultar, OCULTAR_DEPOIS_DE_MS)
    }

    if (travado) {
      mostrar()
      return
    }

    reiniciarRelogio()

    function aoMoverOPonteiro() {
      mostrar()
      reiniciarRelogio()
    }

    window.addEventListener('pointermove', aoMoverOPonteiro)
    return () => {
      window.removeEventListener('pointermove', aoMoverOPonteiro)
      if (temporizador !== null) clearTimeout(temporizador)
    }
  }, [travado])

  return visivel
}
