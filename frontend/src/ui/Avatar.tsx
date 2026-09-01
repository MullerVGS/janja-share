import type { HTMLAttributes } from 'react'
import { iniciaisDoNome } from './avatares'
import estilos from './Avatar.module.css'

type Tamanho = 'mini' | 'pequeno' | 'medio'

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  nome: string
  tamanho?: Tamanho
  /** Anel de 2px em quem está falando — o mesmo sinal da faixa de avatares e da lista. */
  falando?: boolean
  /** Você: um degrau mais claro na rampa do acento, sem virar outra cor. */
  proprio?: boolean
}

/**
 * Identidade efêmera derivada do nome, sem imagem externa nem estado persistente.
 *
 * Todos os avatares dividem a mesma rampa de acento — a cor não identifica ninguém, quem
 * identifica são as iniciais. Uma paleta por nome competia com o único sinal de cor que a sala
 * tem (o acento marca o que está no ar) e enchia a interface de matizes sem significado.
 */
export function Avatar({ nome, tamanho = 'medio', falando, proprio, className, ...resto }: Props) {
  return (
    <span
      {...resto}
      className={[estilos.avatar, estilos[tamanho], className ?? ''].filter(Boolean).join(' ')}
      data-falando={falando || undefined}
      data-proprio={proprio || undefined}
      aria-hidden={resto['aria-label'] ? undefined : true}
    >
      {iniciaisDoNome(nome)}
    </span>
  )
}
