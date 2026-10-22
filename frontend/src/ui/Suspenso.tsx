import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import estilos from './Suspenso.module.css'

interface Props {
  /** O botão que abre o suspenso: ele fica embaixo, e o suspenso abre por cima dele. */
  ancora: RefObject<HTMLElement | null>
  aberto: boolean
  aoFechar(): void
  rotulo: string
  /** `menu` para uma lista de ações; `group` para uma lista que só se lê. */
  papel: 'menu' | 'group'
  children: ReactNode
}

/** Folga entre o botão e o suspenso. */
const FOLGA_PX = 8
/** Metade da largura mínima da caixa mais a margem da janela. */
const MEIA_LARGURA_MINIMA = 164

/**
 * Uma caixa que abre por cima de um botão da barra.
 *
 * Mora fora da barra, num portal no `body`, e é posicionada pela âncora: a barra rola na
 * horizontal (`overflow-x: auto`), e qualquer coisa absoluta dentro dela seria cortada. Fecha no
 * Esc (devolvendo o foco à âncora) e no clique fora — o clique na própria âncora é de quem a
 * alterna, não daqui.
 */
export function Suspenso({ ancora, aberto, aoFechar, rotulo, papel, children }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [posicao, setPosicao] = useState<{ centro: number; base: number } | null>(null)
  const aoFecharAtual = useRef(aoFechar)
  aoFecharAtual.current = aoFechar

  useLayoutEffect(() => {
    if (!aberto) return
    const medir = () => {
      const retangulo = ancora.current?.getBoundingClientRect()
      if (!retangulo) return
      // Perto da borda (o painel da pessoa mora no canto), o centro anda para dentro: a caixa
      // nunca sai da janela.
      const meio = retangulo.left + retangulo.width / 2
      const centro = Math.min(Math.max(meio, MEIA_LARGURA_MINIMA), window.innerWidth - MEIA_LARGURA_MINIMA)
      setPosicao({ centro, base: window.innerHeight - retangulo.top + FOLGA_PX })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [aberto, ancora])

  useEffect(() => {
    if (!aberto) return
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target as Node | null
      if (alvo && (caixa.current?.contains(alvo) || ancora.current?.contains(alvo))) return
      aoFecharAtual.current()
    }
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      aoFecharAtual.current()
      ancora.current?.focus()
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto, ancora])

  if (!aberto) return null
  return createPortal(
    <div
      ref={caixa}
      className={estilos.suspenso}
      role={papel}
      aria-label={rotulo}
      style={posicao ? { left: posicao.centro, bottom: posicao.base } : undefined}
    >
      {children}
    </div>,
    document.body,
  )
}
