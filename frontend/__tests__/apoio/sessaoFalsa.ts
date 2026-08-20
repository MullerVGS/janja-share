import { CHAVE_DA_SESSAO } from '../../src/sessao/sessao'
import type { Credenciais } from '../../src/api/salas'

/**
 * Um JWT com a mesma forma do que o backend emite: três segmentos, carga em base64url. Só o
 * `exp` importa aqui — é dele que o front tira a validade da sessão guardada.
 */
export function jwtFalso(expiraEmMs: number): string {
  const base64url = (valor: unknown) =>
    btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'HS256' })}.${base64url({ exp: Math.floor(expiraEmMs / 1000) })}.assinatura`
}

export function credenciaisFalsas(expiraEmMs: number, nome = 'Ana', slug = 'share'): Credenciais {
  return {
    token: jwtFalso(expiraEmMs),
    urlSfu: 'wss://sfu.example.com',
    slug,
    nomeDaSala: slug,
    identidade: 'ana-a1b2c3',
    nome,
  }
}

/**
 * Escreve direto no `sessionStorage`, como se a aba já tivesse entrado antes do recarregamento —
 * no formato por slug (`Record<slug, {credenciais, expiraEm}>`), fundindo com o que já houver.
 */
export function guardarSessao(credenciais: Credenciais, expiraEm: number): void {
  const cru = sessionStorage.getItem(CHAVE_DA_SESSAO)
  const mapa = cru ? (JSON.parse(cru) as Record<string, unknown>) : {}
  mapa[credenciais.slug] = { credenciais, expiraEm }
  sessionStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(mapa))
}
