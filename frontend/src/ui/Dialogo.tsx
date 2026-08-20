import { useEffect, useRef, type ReactNode } from 'react'
import estilos from './Dialogo.module.css'

interface Props {
  aberto: boolean
  titulo: string
  aoFechar(): void
  children: ReactNode
}

/**
 * Overlay modal — `role="dialog"` + `aria-modal`, com foco inicial e Esc para fechar.
 *
 * O `<dialog>` nativo com `showModal()` prenderia o foco de graça, mas o jsdom (os testes deste
 * projeto) ainda não implementa `showModal`/`close`; por isso o controle de foco fica explícito.
 */
export function Dialogo({ aberto, titulo, aoFechar, children }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    caixaRef.current?.focus()

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div
      className={estilos.fundo}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar()
      }}
    >
      <div ref={caixaRef} className={estilos.caixa} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
        <div className={estilos.cabecalho}>
          <h2 className={estilos.titulo}>{titulo}</h2>
          <button type="button" className={estilos.fechar} onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
