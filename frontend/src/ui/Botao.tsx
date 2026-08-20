import type { ButtonHTMLAttributes, ReactNode } from 'react'
import estilos from './Botao.module.css'

type Aparencia = 'primario' | 'secundario' | 'fantasma' | 'perigo'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  aparencia?: Aparencia
  blocoInteiro?: boolean
  /** Mostra o girador e desabilita o botão — um clique duplo não vira duas requisições. */
  ocupado?: boolean
  children: ReactNode
}

export function Botao({
  aparencia = 'secundario',
  blocoInteiro = false,
  ocupado = false,
  disabled,
  className,
  children,
  ...resto
}: Props) {
  const classes = [estilos.botao, estilos[aparencia], blocoInteiro ? estilos.blocoInteiro : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={classes} disabled={disabled || ocupado} aria-busy={ocupado} {...resto}>
      {ocupado && <span className={estilos.girador} />}
      {children}
    </button>
  )
}
