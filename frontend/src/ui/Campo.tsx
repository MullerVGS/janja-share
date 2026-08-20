import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import estilos from './Campo.module.css'

interface Envelope {
  rotulo: string
  dica?: ReactNode
  className?: string
}

/** Rótulo, controle e dica amarrados por id, para o leitor de tela receber o mesmo conjunto. */
export function Campo({ rotulo, dica, className, ...resto }: Envelope & InputHTMLAttributes<HTMLInputElement>) {
  const gerado = useId()
  const id = resto.id ?? gerado
  const idDica = dica ? `${id}-dica` : undefined

  return (
    <div className={[estilos.campo, className ?? ''].filter(Boolean).join(' ')}>
      <label className={estilos.rotulo} htmlFor={id}>
        {rotulo}
      </label>
      <input {...resto} id={id} aria-describedby={idDica} className={estilos.entrada} />
      {dica && (
        <span className={estilos.dica} id={idDica}>
          {dica}
        </span>
      )}
    </div>
  )
}
