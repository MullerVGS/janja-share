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
  // Só para o Esc não recriar o listener a cada render do dono do diálogo (que passa um
  // `aoFechar` novo toda vez) — o efeito abaixo depende só de `aberto`.
  const aoFecharRef = useRef(aoFechar)
  aoFecharRef.current = aoFechar

  // Quem tinha o foco antes de abrir, para devolver ao fechar. Não dá para capturar isto no
  // efeito que abre o diálogo: o commit do React já aplicou o `autoFocus` do primeiro campo
  // antes de qualquer efeito (passivo ou de layout) rodar, então `document.activeElement` já
  // estaria dentro da caixa. Por isso o rastreio é contínuo, por evento — pega o gatilho no
  // instante em que ele ganhou foco (o clique no botão que abre), bem antes do React processar
  // o `aberto: true` e montar o conteúdo.
  //
  // A checagem usa `closest('[role="dialog"]')` na árvore do DOM, não `caixaRef.current`: o
  // React só liga a ref na fase de *layout*, depois de já ter inserido o nó e disparado o
  // `autoFocus` do campo na fase de *mutation* — no instante em que o `focusin` do campo chega
  // aqui, `caixaRef.current` ainda seria `null`, e o campo passaria por "fora" do diálogo.
  const gatilhoRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    function aoFocoMudar(evento: FocusEvent) {
      const alvo = evento.target
      if (alvo instanceof HTMLElement && !alvo.closest('[role="dialog"]')) gatilhoRef.current = alvo
    }
    document.addEventListener('focusin', aoFocoMudar)
    return () => document.removeEventListener('focusin', aoFocoMudar)
  }, [])

  useEffect(() => {
    if (!aberto) return

    // Se o foco já está em algo de dentro da caixa (o `autoFocus` do primeiro campo), não tomar
    // de volta para o container; só cai nele quando nada lá dentro pediu foco.
    if (!caixaRef.current?.contains(document.activeElement)) caixaRef.current?.focus()

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoFecharRef.current()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      gatilhoRef.current?.focus()
    }
  }, [aberto])

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
