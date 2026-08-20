import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Credenciais } from '../api/convites'

/**
 * A sessão da sala: o que `POST /api/entrar` devolveu.
 *
 * Fica em `sessionStorage` porque `POST /api/entrar` **consome um uso do convite** — deixar a
 * sessão só na memória do React faria um F5 custar um uso, e um convite de cinco usos morreria
 * em cinco recarregamentos. O JWT do LiveKit já vale horas; enquanto ele valer, recarregar
 * reaproveita em vez de bater na porta de novo.
 *
 * `sessionStorage` e não `localStorage`: o direito de publicar na sala morre com a aba, não fica
 * no disco de um notebook emprestado.
 */
interface Sessao {
  credenciais: Credenciais | null
  guardar(credenciais: Credenciais): void
  encerrar(): void
}

export const CHAVE_DA_SESSAO = 'share.sessao'

/** O contrato promete TTL de 8h; isto é só a rede de segurança de um token sem `exp` legível. */
const VALIDADE_SUPOSTA_MS = 8 * 60 * 60 * 1000

/**
 * Sessão que morreria no meio da conexão não serve para reaproveitar. A margem é curta de
 * propósito: cada minuto descartado aqui é um uso de convite gasto à toa.
 */
const MARGEM_MS = 30_000

interface SessaoGuardada {
  credenciais: Credenciais
  expiraEm: number
}

/**
 * Quando o JWT do LiveKit morre, segundo ele mesmo.
 *
 * A carga do JWT é pública (base64url no meio do token) e o `exp` é a autoridade sobre a
 * validade — ler dele evita que uma mudança de TTL no backend deixe o front reaproveitando um
 * token já morto. Sem assinatura conferida: aqui não se decide acesso, só se decide se vale a
 * pena tentar reusar.
 */
function expiracaoDoToken(jwt: string): number | null {
  const carga = jwt.split('.')[1]
  if (!carga) return null
  try {
    const { exp } = JSON.parse(atob(carga.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/** Lê e valida o que está guardado; qualquer coisa fora do formato ou vencida vira `null`. */
export function lerSessaoGuardada(agora: number = Date.now()): Credenciais | null {
  let guardada: SessaoGuardada
  try {
    const cru = sessionStorage.getItem(CHAVE_DA_SESSAO)
    if (!cru) return null
    guardada = JSON.parse(cru) as SessaoGuardada
  } catch {
    return null
  }

  if (typeof guardada?.expiraEm !== 'number' || typeof guardada.credenciais?.token !== 'string') return null
  if (guardada.expiraEm - MARGEM_MS <= agora) {
    esquecerSessao()
    return null
  }
  return guardada.credenciais
}

function anotarSessao(credenciais: Credenciais): void {
  const guardada: SessaoGuardada = {
    credenciais,
    expiraEm: expiracaoDoToken(credenciais.token) ?? Date.now() + VALIDADE_SUPOSTA_MS,
  }
  try {
    sessionStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(guardada))
  } catch {
    // Navegador com armazenamento bloqueado ainda funciona — só volta a gastar um uso por F5.
  }
}

function esquecerSessao(): void {
  try {
    sessionStorage.removeItem(CHAVE_DA_SESSAO)
  } catch {
    // idem
  }
}

const ContextoDaSessao = createContext<Sessao | null>(null)

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [credenciais, setCredenciais] = useState<Credenciais | null>(() => lerSessaoGuardada())

  const valor = useMemo<Sessao>(
    () => ({
      credenciais,
      guardar: (novas) => {
        anotarSessao(novas)
        setCredenciais(novas)
      },
      encerrar: () => {
        esquecerSessao()
        setCredenciais(null)
      },
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
