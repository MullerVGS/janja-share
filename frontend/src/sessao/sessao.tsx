import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Credenciais } from '../api/convites'

/**
 * A sessão da sala: o que `POST /api/entrar` devolveu.
 *
 * Vive só em memória, de propósito. O JWT do LiveKit vale 8 horas e dá direito a publicar na
 * sala; guardá-lo em `localStorage` deixaria esse direito no disco de um notebook emprestado e
 * faria um F5 reentrar na chamada sem ninguém pedir. Recarregar a página derruba a sessão, e o
 * caminho de volta é o convite — que é a porta desenhada para isso.
 */
interface Sessao {
  credenciais: Credenciais | null
  guardar(credenciais: Credenciais): void
  encerrar(): void
}

const ContextoDaSessao = createContext<Sessao | null>(null)

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null)

  const valor = useMemo<Sessao>(
    () => ({
      credenciais,
      guardar: setCredenciais,
      encerrar: () => setCredenciais(null),
    }),
    [credenciais],
  )

  return <ContextoDaSessao value={valor}>{children}</ContextoDaSessao>
}

export function useSessao(): Sessao {
  const sessao = useContext(ContextoDaSessao)
  if (!sessao) throw new Error('useSessao precisa estar dentro de <ProvedorDeSessao>')
  return sessao
}
