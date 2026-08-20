/**
 * Chat efêmero. O payload viaja no data channel do LiveKit e nada é guardado em lugar nenhum —
 * quem entra depois não vê o que passou, por decisão de projeto.
 */

/** O que vai no fio, exatamente como o `AGENTS.md` define: `{nome, texto, ts}`. */
export interface MensagemDoChat {
  nome: string
  texto: string
  ts: number
}

/** A mensagem já na tela: ganha identidade local para o React e a marca de quem escreveu. */
export interface MensagemNaTela extends MensagemDoChat {
  id: string
  propria: boolean
}

export const LIMITE_DO_TEXTO = 800
const LIMITE_DO_NOME = 40

/** Teto da lista em memória. Chat de call é rolagem curta; não há histórico para preservar. */
export const TETO_DE_MENSAGENS = 200

const codificador = new TextEncoder()
const decodificador = new TextDecoder()

/**
 * O `publishData` do SDK exige um buffer não compartilhado; o `TextEncoder` promete só
 * `ArrayBufferLike`. A cópia é o que fecha essa diferença — e o payload é uma linha de chat.
 */
export function empacotar(mensagem: MensagemDoChat): Uint8Array<ArrayBuffer> {
  return new Uint8Array(codificador.encode(JSON.stringify(mensagem)))
}

/**
 * Desempacota o que chegou pelo data channel, ou `null` se não for uma mensagem de chat.
 *
 * O canal é compartilhado e o remetente é outro navegador: nada aqui pode assumir formato.
 * Campos são conferidos um a um e os tamanhos truncados — uma mensagem gigante de um par
 * malcomportado vira uma mensagem grande, não uma tela travada.
 */
export function desempacotar(dados: Uint8Array): MensagemDoChat | null {
  let cru: unknown
  try {
    cru = JSON.parse(decodificador.decode(dados))
  } catch {
    return null
  }
  if (cru === null || typeof cru !== 'object') return null

  const { nome, texto, ts } = cru as { nome?: unknown; texto?: unknown; ts?: unknown }
  if (typeof nome !== 'string' || typeof texto !== 'string') return null
  if (texto.trim() === '') return null

  return {
    nome: nome.trim().slice(0, LIMITE_DO_NOME) || 'alguém',
    texto: texto.slice(0, LIMITE_DO_TEXTO),
    ts: typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now(),
  }
}

/**
 * Insere mantendo a lista ordenada por `ts`.
 *
 * O `ts` é o relógio de quem enviou, então uma mensagem pode chegar "atrasada" em relação a
 * outra já na tela. A varredura é de trás para frente porque o caso normal — a mensagem mais
 * nova é a última — termina na primeira comparação. Empate mantém a ordem de chegada.
 */
export function inserirEmOrdem(lista: readonly MensagemNaTela[], nova: MensagemNaTela): MensagemNaTela[] {
  let posicao = lista.length
  while (posicao > 0 && (lista[posicao - 1] as MensagemNaTela).ts > nova.ts) posicao -= 1

  const proxima = [...lista.slice(0, posicao), nova, ...lista.slice(posicao)]
  return proxima.length > TETO_DE_MENSAGENS ? proxima.slice(proxima.length - TETO_DE_MENSAGENS) : proxima
}

let contador = 0

/** Identidade só para o React — não viaja no fio (o payload do contrato tem três campos). */
export function novaIdentidadeLocal(): string {
  contador += 1
  return `m${contador}`
}
