import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import estilos from './Campo.module.css'

interface Envelope {
  rotulo: string
  dica?: ReactNode
  erro?: string
  className?: string
}

/**
 * Rótulo, controle, dica e erro amarrados por id — o erro é anunciado por `aria-describedby` e
 * o controle marcado com `aria-invalid`, para leitor de tela receber o mesmo que a borda diz.
 */
function Envolver({
  rotulo,
  dica,
  erro,
  className,
  id,
  children,
}: Envelope & {
  id: string
  children: (props: { id: string; descrito?: string; invalido: boolean }) => ReactNode
}) {
  const idDica = dica ? `${id}-dica` : undefined
  const idErro = erro ? `${id}-erro` : undefined
  const descrito = [idErro, idDica].filter(Boolean).join(' ') || undefined

  return (
    <div className={[estilos.campo, className ?? ''].filter(Boolean).join(' ')}>
      <label className={estilos.rotulo} htmlFor={id}>
        {rotulo}
      </label>
      {children({ id, descrito, invalido: Boolean(erro) })}
      {erro && (
        <span className={estilos.erro} id={idErro} role="alert">
          {erro}
        </span>
      )}
      {dica && (
        <span className={estilos.dica} id={idDica}>
          {dica}
        </span>
      )}
    </div>
  )
}

export function Campo({ rotulo, dica, erro, className, ...resto }: Envelope & InputHTMLAttributes<HTMLInputElement>) {
  const gerado = useId()
  const id = resto.id ?? gerado
  return (
    <Envolver rotulo={rotulo} dica={dica} erro={erro} className={className} id={id}>
      {({ id, descrito, invalido }) => (
        <input
          {...resto}
          id={id}
          aria-describedby={descrito}
          aria-invalid={invalido || undefined}
          className={[estilos.entrada, invalido ? estilos.comErro : ''].filter(Boolean).join(' ')}
        />
      )}
    </Envolver>
  )
}

export function CampoSelecao({
  rotulo,
  dica,
  erro,
  className,
  children,
  ...resto
}: Envelope & SelectHTMLAttributes<HTMLSelectElement>) {
  const gerado = useId()
  const id = resto.id ?? gerado
  return (
    <Envolver rotulo={rotulo} dica={dica} erro={erro} className={className} id={id}>
      {({ id, descrito, invalido }) => (
        <select
          {...resto}
          id={id}
          aria-describedby={descrito}
          aria-invalid={invalido || undefined}
          className={[estilos.entrada, invalido ? estilos.comErro : ''].filter(Boolean).join(' ')}
        >
          {children}
        </select>
      )}
    </Envolver>
  )
}
