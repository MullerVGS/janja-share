import { amostraVaziaDoEspectador, type AmostraDoEspectador, type Protocolo } from './amostra'

/**
 * O relato: quem assiste uma tela manda a quem a publica, a cada 2 s, a última amostra do que
 * está recebendo. Viaja no data channel sem garantia de entrega — um relato perdido é
 * substituído pelo próximo, e um emissor sem relato há 6 s vê o espectador como "sumiu".
 */

export const TOPICO_DA_TELEMETRIA = 'telemetria'
export const INTERVALO_DO_RELATO_MS = 2000
export const VALIDADE_DO_RELATO_MS = 6000

/** O payload é a amostra do espectador; no fio ela vai com a versão do formato. */
export type Relato = AmostraDoEspectador

/** O que o emissor guarda de cada pessoa que assiste. */
export interface Espectador {
  identidade: string
  nome: string
  relato: Relato
  vistoEm: number
}

const VERSAO = 1
const LIMITE_DE_TEXTO = 60

const codificador = new TextEncoder()
const decodificador = new TextDecoder()

export function empacotarRelato(amostra: AmostraDoEspectador): Uint8Array<ArrayBuffer> {
  return new Uint8Array(codificador.encode(JSON.stringify({ v: VERSAO, ...amostra })))
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function contagem(valor: unknown): number {
  const n = numero(valor)
  return n === null || n < 0 ? 0 : n
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor.slice(0, LIMITE_DE_TEXTO) : null
}

function booleano(valor: unknown): boolean | null {
  return typeof valor === 'boolean' ? valor : null
}

function protocolo(valor: unknown): Protocolo | null {
  return valor === 'udp' || valor === 'tcp' ? valor : null
}

/**
 * Desempacota o que chegou, ou `null` se não for um relato.
 *
 * O remetente é outro navegador: cada campo é conferido um a um e o que não bate vira o valor
 * vazio daquele campo, não um relato descartado — um relato meio cego ainda diz quem está aí.
 */
export function desempacotarRelato(dados: Uint8Array): Relato | null {
  let cru: unknown
  try {
    cru = JSON.parse(decodificador.decode(dados))
  } catch {
    return null
  }
  if (cru === null || typeof cru !== 'object' || Array.isArray(cru)) return null
  const campo = cru as Record<string, unknown>
  if (campo.v !== VERSAO) return null

  const freezes = (campo.freezes ?? {}) as Record<string, unknown>
  return {
    ...amostraVaziaDoEspectador(numero(campo.emMs) ?? Date.now()),
    fpsDecodificado: numero(campo.fpsDecodificado),
    fpsRecebido: numero(campo.fpsRecebido),
    kbps: numero(campo.kbps),
    quadrosDescartados: contagem(campo.quadrosDescartados),
    freezes: { quantidade: contagem(freezes.quantidade), duracaoMs: contagem(freezes.duracaoMs) },
    desvioEntreQuadrosMs: numero(campo.desvioEntreQuadrosMs),
    atrasoDoBufferMs: numero(campo.atrasoDoBufferMs),
    perda: numero(campo.perda),
    jitterMs: numero(campo.jitterMs),
    largura: numero(campo.largura),
    altura: numero(campo.altura),
    codec: texto(campo.codec),
    decoder: texto(campo.decoder),
    decoderEmHardware: booleano(campo.decoderEmHardware),
    rtt: numero(campo.rtt),
    protocolo: protocolo(campo.protocolo),
  }
}

export function sumiu(espectador: Pick<Espectador, 'vistoEm'>, agora = Date.now()): boolean {
  return agora - espectador.vistoEm > VALIDADE_DO_RELATO_MS
}
