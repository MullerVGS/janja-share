import type { ReactNode } from 'react'
import estilos from './Aviso.module.css'

type Tom = 'erro' | 'neutro'

export function Aviso({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <div className={`${estilos.aviso} ${estilos[tom]}`} role={tom === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
