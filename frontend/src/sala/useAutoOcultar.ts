import { useEffect, useRef, useState } from 'react'

const OCULTAR_DEPOIS_DE_MS = 2600

/**
 * Se a interface flutuante do palco está à mostra. Some depois de `atrasoMs` sem o ponteiro se
 * mexer (default 2600 — a interface do palco; a pílula de tela cheia usa 2000, por isso o
 * atraso é parâmetro, não constante); qualquer movimento traz de volta e reinicia a contagem.
 * `travado` (gaveta aberta, menu aberto, foco de teclado dentro) trava visível o tempo todo —
 * ao destravar, o relógio recomeça do zero, não do que sobrava antes da trava.
 *
 * O relógio em si não é estado do React: só a transição visível↔oculto muda `useState`, para o
 * movimento do ponteiro não bater `setState` (e re-render) a cada evento, coisa que aconteceria
 * a até 60 vezes por segundo.
 */
export function useAutoOcultar(travado: boolean, atrasoMs: number = OCULTAR_DEPOIS_DE_MS): boolean {
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

    if (travado) {
      mostrar()
      return
    }

    function reiniciarRelogio() {
      if (temporizador !== null) clearTimeout(temporizador)
      temporizador = setTimeout(ocultar, atrasoMs)
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
  }, [travado, atrasoMs])

  return visivel
}
