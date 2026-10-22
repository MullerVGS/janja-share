import type { CSSProperties, HTMLAttributes } from 'react'
import { corDoNome, iniciaisDoNome } from './avatares'
import estilos from './Avatar.module.css'

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  nome: string
  /** O diâmetro em px: 24 na coluna e no rodapé, 32 no painel da pessoa, 40 no chat, 80 no quadro. */
  tamanho?: number
  /** O anel verde de quem está falando — o mesmo sinal na coluna, na grade e no chat. */
  falando?: boolean
}

/**
 * Identidade efêmera derivada do nome, sem imagem externa nem estado persistente: as iniciais
 * sobre a cor que o nome sorteia (`corDoNome`).
 */
export function Avatar({ nome, tamanho = 32, falando, className, style, ...resto }: Props) {
  const estilo = {
    ...style,
    '--tamanho': `${tamanho}px`,
    background: corDoNome(nome),
  } as CSSProperties
  return (
    <span
      {...resto}
      className={[estilos.avatar, className ?? ''].filter(Boolean).join(' ')}
      style={estilo}
      data-falando={falando || undefined}
      aria-hidden={resto['aria-label'] ? undefined : true}
    >
      {iniciaisDoNome(nome)}
    </span>
  )
}
