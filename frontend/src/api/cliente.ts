/**
 * A costura com o backend, descrita em `docs/CONTRATO-API.md`.
 *
 * O contrato responde erro sempre como `{ "erro": "<codigo>" }` — o código é o dado, a frase
 * em português é escolha desta camada. Traduzir aqui, e não em cada tela, é o que garante que
 * `sala_existe` diga a mesma coisa no diálogo de criar e na linha de entrar.
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

/**
 * Códigos do contrato + os dois que só existem do lado do navegador (`sem_conexao`,
 * `resposta_estranha`).
 *
 * Os genéricos (`validacao`, `nao_encontrado`, `erro`, `erro_interno`) não são detalhe de
 * implementação do backend: são o que o filtro global emite quando a exceção não traz código
 * próprio, e chegam aqui em todo erro de validação e em todo 500. Sem frase, viravam
 * "O servidor respondeu 400 sem explicar o motivo".
 *
 * `nome_invalido` e `nome_da_sala_invalido` são códigos separados de propósito: o primeiro é o
 * nome da pessoa (1 a 40 caracteres), o segundo é o nome da sala — que pode ter 1 a 40
 * caracteres e ainda assim ser recusado por derrapar no slug (um nome só de emoji não vira
 * endereço). A mesma frase mentiria sobre um dos dois motivos.
 */
const FRASES: Record<string, string> = {
  nome_invalido: 'Escolha um nome com 1 a 40 caracteres.',
  nome_da_sala_invalido: 'Esse nome de sala não é válido — use letras ou números, até 40 caracteres.',
  sala_existe: 'Já existe uma sala com esse nome — entre nela ou escolha outro.',
  sala_nao_existe: 'Essa sala não existe mais.',
  senha_incorreta: 'Senha incorreta.',
  sala_cheia: 'A sala está cheia.',
  muitas_salas: 'Tem sala demais no ar agora. Tente daqui a pouco.',
  espere: 'Muitas tentativas. Espere alguns segundos.',
  sfu_indisponivel: 'O servidor de mídia não respondeu. Tente de novo em instantes.',
  validacao: 'O servidor recusou os dados enviados. Revise os campos e tente de novo.',
  nao_encontrado: 'Este endereço não existe no servidor.',
  erro: 'O servidor recusou a requisição.',
  erro_interno: 'Algo quebrou no servidor. Tente de novo em instantes.',
  sem_conexao: 'Não foi possível falar com o servidor. Confira sua conexão.',
}

export function mensagemDoErro(erro: unknown): string {
  if (!(erro instanceof ErroDaApi)) return 'Algo deu errado.'
  const frase = FRASES[erro.codigo]
  if (frase) return frase
  return `O servidor respondeu ${erro.status} sem explicar o motivo.`
}

/**
 * O corpo de erro vem do backend, mas intermediários HTTP também podem responder sem seguir
 * o contrato. Por isso o caminho de fallback nunca inventa um código
 * de domínio: `resposta_estranha` diz exatamente o que houve.
 */
function erroDeCorpo(status: number, corpo: unknown): ErroDaApi {
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
function urlDaApi(caminho: string): string {
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
