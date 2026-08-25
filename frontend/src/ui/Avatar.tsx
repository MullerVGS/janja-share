import type { HTMLAttributes } from 'react'
import { corDoNome, iniciaisDoNome } from './avatares'
import estilos from './Avatar.module.css'

type Tamanho = 'mini' | 'pequeno' | 'medio'
type Status = 'online' | 'falando'

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  nome: string
  tamanho?: Tamanho
  status?: Status
}

/** Identidade efêmera derivada do nome, sem imagem externa nem estado persistente. */
export function Avatar({ nome, tamanho = 'medio', status, className, ...resto }: Props) {
  return (
    <span
      {...resto}
      className={[estilos.avatar, estilos[tamanho], className ?? ''].filter(Boolean).join(' ')}
      data-status={status}
      style={{ ...resto.style, backgroundColor: corDoNome(nome) }}
      aria-hidden={resto['aria-label'] ? undefined : true}
    >
      {iniciaisDoNome(nome)}
    </span>
  )
}
