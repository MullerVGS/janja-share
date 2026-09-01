import { IconeMarca } from './Icone'
import estilos from './Marca.module.css'

/** A marca do produto: o símbolo em caixa de contorno de acento, com o nome ao lado. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className={[estilos.marca, compacta ? estilos.compacta : ''].filter(Boolean).join(' ')}>
      <span className={estilos.simbolo} aria-hidden="true">
        <IconeMarca tamanho={compacta ? 20 : 17} />
      </span>
      {!compacta && <span className={estilos.nome}>janja-share</span>}
    </span>
  )
}
