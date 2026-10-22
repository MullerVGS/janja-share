import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'
import { env } from '../shared/env'
import { GUARDA_DA_SALA_FIXA_S } from '../shared/livekit/livekit-room.provider'

/**
 * A assinatura do link de uma Sala fixa (ADR 0013): o que deixa o link trazer a Sala de volta
 * quando o SFU reiniciou e ela não existe mais.
 *
 * Vai na URL como `?k=<carga>.<mac>`. A carga é legível de propósito — nome, visibilidade e
 * validade, em base64url — porque é dela que o app tira o "mesmo nome" para recriar a Sala; o
 * MAC cobre a carga **e** o slug, que vem do caminho. Trocar uma letra de qualquer um dos dois
 * invalida o link.
 *
 * A validade existe para a Sala continuar sendo guardada por tempo limitado: sem ela, o link
 * recriaria a Sala para sempre e "fica guardada por 7 dias" seria mentira. Cada entrada emite
 * uma assinatura nova, então quem volta dentro do prazo leva o prazo adiante. O dia a mais
 * cobre o tempo que a pessoa passou dentro da Sala — a guarda do SFU só começa quando o último sai.
 */
export const VALIDADE_DA_ASSINATURA_S = GUARDA_DA_SALA_FIXA_S + 24 * 60 * 60

/** 16 bytes de HMAC-SHA256: 128 bits, 22 caracteres na URL. */
const TAMANHO_DO_MAC = 16

/**
 * Rótulo da derivação. Mudar o rótulo invalida todos os links assinados de uma vez — é a forma
 * de revogar sem trocar o segredo do LiveKit.
 */
const ROTULO_DA_CHAVE = 'janja-share/assinatura-do-link/v1'

export interface DadosAssinados {
  slug: string
  nome: string
  privada: boolean
}

export type LeituraDaAssinatura =
  | { tipo: 'valida'; nome: string; privada: boolean }
  | { tipo: 'vencida'; nome: string; privada: boolean }
  | { tipo: 'invalida' }

let chaveMemo: { segredo: string; chave: Buffer } | undefined

/**
 * A chave sai do `LIVEKIT_API_SECRET` por HKDF, e não de uma variável nova: a instância que já
 * roda não precisa mudar o `.env`, e quem tem esse segredo já cria qualquer Sala direto no SFU —
 * a assinatura não dá a ninguém um poder que o segredo já não desse. O rótulo separa os usos:
 * a chave derivada não assina JWT do LiveKit, e o segredo cru não assina link.
 */
function chave(): Buffer {
  const { livekitApiSecret } = env()
  if (chaveMemo?.segredo !== livekitApiSecret) {
    const derivada = Buffer.from(hkdfSync('sha256', livekitApiSecret, Buffer.alloc(0), ROTULO_DA_CHAVE, 32))
    chaveMemo = { segredo: livekitApiSecret, chave: derivada }
  }
  return chaveMemo.chave
}

/**
 * O que o MAC cobre: slug, nome, privada, fixa e a validade. `fixa` é sempre verdadeiro — só a
 * Sala fixa ganha link assinado —, mas entra na conta para uma assinatura nunca servir para
 * outro tipo de Sala se um dia houver.
 */
function mac(dados: DadosAssinados, ate: number): Buffer {
  const mensagem = JSON.stringify(['v1', dados.slug, dados.nome, dados.privada, true, ate])
  return createHmac('sha256', chave()).update(mensagem).digest().subarray(0, TAMANHO_DO_MAC)
}

export function assinarLink(dados: DadosAssinados, agoraMs = Date.now()): string {
  const ate = Math.floor(agoraMs / 1000) + VALIDADE_DA_ASSINATURA_S
  const carga = Buffer.from(JSON.stringify([dados.nome, dados.privada ? 1 : 0, ate])).toString('base64url')
  return `${carga}.${mac(dados, ate).toString('base64url')}`
}

/**
 * Confere a assinatura contra o slug do caminho. A vencida ainda devolve nome e visibilidade:
 * não recria nada, mas é com eles que o app oferece "Criar de novo com o mesmo nome".
 */
export function lerAssinatura(slug: string, assinatura: string, agoraMs = Date.now()): LeituraDaAssinatura {
  const [cargaCrua, macCru, ...sobra] = assinatura.split('.')
  if (!cargaCrua || !macCru || sobra.length > 0) return { tipo: 'invalida' }

  let carga: unknown
  try {
    carga = JSON.parse(Buffer.from(cargaCrua, 'base64url').toString('utf8'))
  } catch {
    return { tipo: 'invalida' }
  }
  if (!Array.isArray(carga) || carga.length !== 3) return { tipo: 'invalida' }
  const [nome, privadaCrua, ate] = carga as unknown[]
  if (typeof nome !== 'string' || (privadaCrua !== 0 && privadaCrua !== 1) || !Number.isInteger(ate)) {
    return { tipo: 'invalida' }
  }

  const privada = privadaCrua === 1
  const esperado = mac({ slug, nome, privada }, ate as number)
  const recebido = Buffer.from(macCru, 'base64url')
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return { tipo: 'invalida' }

  if ((ate as number) * 1000 < agoraMs) return { tipo: 'vencida', nome, privada }
  return { tipo: 'valida', nome, privada }
}
