/**
 * A costura com o backend, descrita em `docs/CONTRATO-API.md`.
 *
 * O contrato responde erro sempre como `{ "erro": "<codigo>" }` — o código é o dado, a frase
 * em português é escolha desta camada. Traduzir aqui, e não em cada tela, é o que garante que
 * `convite_esgotado` diga a mesma coisa na entrada e no painel.
 */

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
  ) {
    super(codigo)
    this.name = 'ErroDaApi'
  }
}

/** Códigos do contrato + os dois que só existem do lado do navegador (`sem_conexao`, `resposta_estranha`). */
const FRASES: Record<string, string> = {
  convite_invalido: 'Este convite não existe. Confira se o link foi copiado inteiro.',
  convite_expirado: 'Este convite expirou. Peça um link novo a quem te chamou.',
  convite_esgotado: 'Este convite já foi usado o número de vezes permitido.',
  convite_revogado: 'Este convite foi revogado.',
  nome_invalido: 'Escolha um nome com 1 a 40 caracteres.',
  sem_conexao: 'Não foi possível falar com o servidor. Confira sua conexão.',
}

export function mensagemDoErro(erro: unknown): string {
  if (!(erro instanceof ErroDaApi)) return 'Algo deu errado.'
  const frase = FRASES[erro.codigo]
  if (frase) return frase
  return `O servidor respondeu ${erro.status} sem explicar o motivo.`
}

/**
 * O corpo de erro vem do backend, mas quem está entre ele e o navegador (reverse proxy, reverse proxy)
 * também responde — e sem o contrato. Por isso o caminho de fallback nunca inventa um código
 * de domínio: `resposta_estranha` diz exatamente o que houve.
 */
export function erroDeCorpo(status: number, corpo: unknown): ErroDaApi {
  if (corpo !== null && typeof corpo === 'object' && 'erro' in corpo) {
    const { erro } = corpo as { erro: unknown }
    if (typeof erro === 'string') return new ErroDaApi(status, erro)
  }
  return new ErroDaApi(status, 'resposta_estranha')
}

/**
 * A API é sempre a mesma origem da página. A origem entra explícita porque o `fetch` do Node
 * (o que os testes usam) recusa caminho relativo — sem isto o erro apareceria como falha de
 * rede em vez de URL mal formada.
 */
export function urlDaApi(caminho: string): string {
  const origem = typeof globalThis.location === 'undefined' ? '' : globalThis.location.origin
  return `${origem}${caminho}`
}

export async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(urlDaApi(caminho), { credentials: 'same-origin', ...init })
  } catch {
    throw new ErroDaApi(0, 'sem_conexao')
  }
  if (resposta.status === 204) return undefined as T
  const corpo: unknown = await resposta.json().catch(() => undefined)
  if (!resposta.ok) throw erroDeCorpo(resposta.status, corpo)
  return corpo as T
}

export function enviarJson<T>(caminho: string, metodo: 'POST' | 'DELETE', corpo?: unknown): Promise<T> {
  return pedir<T>(caminho, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}
