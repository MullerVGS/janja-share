import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Credenciais } from '../api/salas'

/**
 * A sessão do navegador: o que `POST /api/salas` ou `POST /api/salas/:slug/entrar` devolveram,
 * guardado **por slug** — o app abre várias salas em abas diferentes, e cada uma tem seu próprio
 * passe.
 *
 * Fica em `sessionStorage`, não `localStorage`: o direito de publicar numa sala morre com a
 * aba, não fica no disco de um notebook emprestado. O JWT do LiveKit já vale horas; enquanto ele
 * valer, recarregar reaproveita em vez de bater na porta de novo.
 */
interface Sessao {
  credenciaisDe(slug: string): Credenciais | null
  guardar(credenciais: Credenciais): void
  encerrar(slug: string): void
}

export const CHAVE_DA_SESSAO = 'janja-share.sessao'

/** O contrato promete TTL de 8h; isto é só a rede de segurança de um token sem `exp` legível. */
const VALIDADE_SUPOSTA_MS = 8 * 60 * 60 * 1000

/** Sessão que morreria no meio da conexão não serve para reaproveitar. */
const MARGEM_MS = 30_000

interface SessaoGuardada {
  credenciais: Credenciais
  expiraEm: number
}

type MapaDeSessoes = Record<string, SessaoGuardada>

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

function ehCredenciais(valor: unknown): valor is Credenciais {
  if (valor === null || typeof valor !== 'object') return false
  const { token, slug } = valor as Partial<Credenciais>
  return typeof token === 'string' && typeof slug === 'string'
}

function ehSessaoGuardada(valor: unknown): valor is SessaoGuardada {
  if (valor === null || typeof valor !== 'object') return false
  const { credenciais, expiraEm } = valor as Partial<SessaoGuardada>
  return typeof expiraEm === 'number' && ehCredenciais(credenciais)
}

/**
 * Lê o mapa guardado, filtrando o que não serve: entradas malformadas e sessões vencidas.
 *
 * O formato anterior era um único `{credenciais, expiraEm}`, sem chave de slug por cima — e
 * por acaso tem a mesma forma de uma `SessaoGuardada` isolada. Essa coincidência identifica o formato aqui:
 * ele passa no teste de "é uma sessão guardada válida" no nível errado (o objeto todo, não uma
 * entrada dele), e por isso é descartado por inteiro, não migrado.
 */
function lerMapaGuardado(agora: number): MapaDeSessoes {
  let cru: unknown
  try {
    cru = JSON.parse(sessionStorage.getItem(CHAVE_DA_SESSAO) ?? 'null')
  } catch {
    return {}
  }
  if (cru === null || typeof cru !== 'object' || Array.isArray(cru)) return {}
  if (ehSessaoGuardada(cru)) return {}

  const mapa: MapaDeSessoes = {}
  for (const [slug, valor] of Object.entries(cru as Record<string, unknown>)) {
    if (ehSessaoGuardada(valor) && valor.expiraEm - MARGEM_MS > agora) mapa[slug] = valor
  }
  return mapa
}

function escreverMapa(mapa: MapaDeSessoes): void {
  try {
    sessionStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(mapa))
  } catch {
    // Navegador com armazenamento bloqueado ainda funciona — só volta a pedir a senha por F5.
  }
}

const ContextoDaSessao = createContext<Sessao | null>(null)

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [mapa, setMapa] = useState<MapaDeSessoes>(() => lerMapaGuardado(Date.now()))

  const valor = useMemo<Sessao>(
    () => ({
      // Reconfere a validade a cada chamada, com o relógio de agora — não só a que filtrou o
      // `useState` inicial. Sem isto, uma aba aberta além das 8h do JWT entregaria uma
      // credencial morta, e a pessoa veria erro de conexão em vez de voltar para o início.
      credenciaisDe: (slug) => {
        const entrada = mapa[slug]
        if (!entrada) return null
        return entrada.expiraEm - MARGEM_MS > Date.now() ? entrada.credenciais : null
      },
      // Atualização funcional nos dois: duas chamadas de `guardar` (ou `guardar` seguido de
      // `encerrar`) no mesmo tick partiriam do mesmo `mapa` capturado pelo `useMemo`, e a
      // segunda apagaria o efeito da primeira — tanto do estado quanto do `sessionStorage`.
      guardar: (credenciais) => {
        setMapa((atual) => {
          const proximo: MapaDeSessoes = {
            ...atual,
            [credenciais.slug]: {
              credenciais,
              expiraEm: expiracaoDoToken(credenciais.token) ?? Date.now() + VALIDADE_SUPOSTA_MS,
            },
          }
          escreverMapa(proximo)
          return proximo
        })
      },
      encerrar: (slug) => {
        setMapa((atual) => {
          const { [slug]: _fora, ...proximo } = atual
          escreverMapa(proximo)
          return proximo
        })
      },
    }),
    [mapa],
  )

  return <ContextoDaSessao value={valor}>{children}</ContextoDaSessao>
}

export function useSessao(): Sessao {
  const sessao = useContext(ContextoDaSessao)
  if (!sessao) throw new Error('useSessao precisa estar dentro de <ProvedorDeSessao>')
  return sessao
}
