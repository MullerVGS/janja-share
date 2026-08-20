import { vi } from 'vitest'

export interface Resposta {
  status?: number
  corpo?: unknown
}

export interface Chamada {
  metodo: string
  caminho: string
  corpo: unknown
}

/** O que o app pediu, na ordem — é como o teste confere o corpo que saiu do formulário. */
export const chamadas: Chamada[] = []

/**
 * Troca o `fetch` global por um roteador de `MÉTODO /caminho`.
 *
 * Fica no `fetch`, e não no módulo da API, de propósito: assim o teste atravessa de verdade a
 * tradução de erro de `api/cliente.ts` em vez de simular o que ela faria.
 */
export function servir(rotas: Record<string, Resposta | (() => Resposta)>): void {
  chamadas.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url
      const metodo = (init?.method ?? 'GET').toUpperCase()
      const caminho = new URL(url, 'http://localhost').pathname
      chamadas.push({
        metodo,
        caminho,
        corpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      })

      const rota = rotas[`${metodo} ${caminho}`]
      if (!rota) {
        return new Response(JSON.stringify({ erro: 'rota_nao_mapeada_no_teste' }), {
          status: 501,
          headers: { 'content-type': 'application/json' },
        })
      }

      const { status = 200, corpo } = typeof rota === 'function' ? rota() : rota
      return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
}

/** Rede fora: o `fetch` rejeita, como faz o navegador quando não há servidor do outro lado. */
export function servidorMudo(): void {
  chamadas.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }),
  )
}
