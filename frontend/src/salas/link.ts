/**
 * O link da Sala (ADR 0013): `/sala/<slug>` e, na Sala fixa, `?k=<assinatura>` — o pedaço que a
 * traz de volta se o servidor de mídia tiver reiniciado. O link é a identidade da Sala: é ele
 * que vai no convite, na barra de endereço e em "Suas salas".
 */

/** Nome do parâmetro da assinatura na URL. Curto de propósito: o convite é colado em chat. */
export const PARAMETRO_DA_ASSINATURA = 'k'

/** O que a Sala fixa promete, na mesma frase em todo lugar onde o prazo aparece. */
export const FRASE_DA_SALA_FIXA = 'Fica guardada por 7 dias depois que todos saírem.'
export const FRASE_DA_SALA_EFEMERA = 'Some quando todos saírem.'

export function fraseDaGuarda(fixa: boolean): string {
  return fixa ? FRASE_DA_SALA_FIXA : FRASE_DA_SALA_EFEMERA
}

export function enderecoDaSala(slug: string, assinatura?: string | null): string {
  const caminho = `/sala/${encodeURIComponent(slug)}`
  return assinatura ? `${caminho}?${PARAMETRO_DA_ASSINATURA}=${encodeURIComponent(assinatura)}` : caminho
}

export interface CargaDaAssinatura {
  nome: string
  privada: boolean
  /** Até quando o link recria a Sala, em ms. */
  ate: number
}

/**
 * A carga legível da assinatura: `[nome, privada (0|1), validade em s]` em base64url, antes do
 * ponto. Lida sem conferir o MAC — quem confere é o servidor. Aqui ela só serve para o app
 * oferecer "Criar de novo com o mesmo nome" quando o link já não traz a Sala.
 */
export function lerCargaDaAssinatura(assinatura: string | null | undefined): CargaDaAssinatura | null {
  const carga = assinatura?.split('.')[0]
  if (!carga) return null
  try {
    const base64 = carga.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0))
    const dados: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!Array.isArray(dados) || dados.length !== 3) return null
    const [nome, privada, ate] = dados as unknown[]
    if (typeof nome !== 'string' || (privada !== 0 && privada !== 1) || typeof ate !== 'number') return null
    return { nome, privada: privada === 1, ate: ate * 1000 }
  } catch {
    return null
  }
}

/** O sufixo sorteado de 6 hex que a Sala privada ganha no slug (ADR 0011). */
const SUFIXO_PRIVADO = /-[0-9a-f]{6}$/

/**
 * O melhor palpite do nome e da visibilidade de uma Sala que não existe mais, quando nem o link
 * nem "Suas salas" sabem: o slug sem o sufixo privado, com espaços no lugar dos hífens. Uma
 * Sala pública cujo nome termine em seis letras hexadecimais seria lida como privada — raro, e
 * o pior que acontece é a nova nascer privada.
 */
export function palpiteDoSlug(slug: string): { nome: string; privada: boolean } {
  const privada = SUFIXO_PRIVADO.test(slug)
  const base = (privada ? slug.replace(SUFIXO_PRIVADO, '') : slug).replace(/-+/g, ' ').trim()
  const nome = base === '' ? slug : base.charAt(0).toUpperCase() + base.slice(1)
  return { nome, privada }
}
