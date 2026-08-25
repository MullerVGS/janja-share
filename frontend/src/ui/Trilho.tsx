import type { ReactNode } from 'react'
import { Marca } from './Marca'
import estilos from './Trilho.module.css'

interface PropsDoTrilho {
  children: ReactNode
  aoClicarNaMarca?: () => void
  rotuloDaMarca?: string
}

/** Moldura compartilhada do trilho principal no saguão e dentro de uma sala. */
export function Trilho({ children, aoClicarNaMarca, rotuloDaMarca = 'janja-share' }: PropsDoTrilho) {
  const marca = <Marca compacta />

  return (
    <div className={estilos.trilho}>
      {aoClicarNaMarca ? (
        <button
          type="button"
          className={estilos.marca}
          aria-label={rotuloDaMarca}
          title={rotuloDaMarca}
          onClick={aoClicarNaMarca}
        >
          {marca}
        </button>
      ) : (
        <span className={estilos.marca} title={rotuloDaMarca}>
          {marca}
        </span>
      )}
      <span className={estilos.divisor} />
      {children}
    </div>
  )
}

interface PropsDoItem {
  rotulo: string
  children: ReactNode
  ativo?: boolean
  className?: string
  aoClicar?: () => void
}

export function ItemDoTrilho({ rotulo, children, ativo = false, className, aoClicar }: PropsDoItem) {
  const classes = [estilos.item, className ?? ''].filter(Boolean).join(' ')
  const propriedades = {
    className: classes,
    title: rotulo,
    'aria-label': rotulo,
    'aria-current': ativo ? ('page' as const) : undefined,
    'data-ativo': ativo || undefined,
  }

  return aoClicar ? (
    <button type="button" {...propriedades} onClick={aoClicar}>
      {children}
    </button>
  ) : (
    <span {...propriedades}>{children}</span>
  )
}
