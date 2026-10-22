/**
 * "Suas salas": as Salas fixas que este navegador visitou, para voltar em um clique (ADR 0013).
 *
 * Mora no `localStorage` porque é memória deste navegador, não da Sala: o servidor não sabe
 * quem visitou o quê, e não passa a saber. A efêmera não entra — ela some minutos depois de
 * todos saírem, e a lista viraria um cemitério de links mortos.
 *
 * Mesmo esquema das preferências: um objeto versionado, leitura tolerante (item estranho é
 * descartado, não derruba a lista) e escrita que nunca lança.
 */
export const CHAVE_DAS_SUAS_SALAS = 'janja-share.suas-salas'
const VERSAO = 1

/** Mais que isso não cabe numa olhada; a mais antiga sai. */
export const LIMITE_DE_SUAS_SALAS = 12

/** Depois disso a Sala certamente expirou (7 dias de guarda + folga) e o item só ocupa espaço. */
const ESQUECER_DEPOIS_MS = 30 * 24 * 60 * 60 * 1000

export interface SalaLembrada {
  slug: string
  nome: string
  privada: boolean
  /** A assinatura mais recente que este navegador recebeu — o `?k=` do link. */
  assinatura: string | null
  /** Última vez que este navegador entrou nela, em ms. */
  em: number
}

function ehSalaLembrada(valor: unknown): valor is SalaLembrada {
  if (valor === null || typeof valor !== 'object') return false
  const { slug, nome, privada, assinatura, em } = valor as Partial<SalaLembrada>
  return (
    typeof slug === 'string' &&
    slug !== '' &&
    typeof nome === 'string' &&
    typeof privada === 'boolean' &&
    (assinatura === null || typeof assinatura === 'string') &&
    typeof em === 'number'
  )
}

export function lerSuasSalas(agora = Date.now()): SalaLembrada[] {
  let cru: unknown
  try {
    cru = JSON.parse(localStorage.getItem(CHAVE_DAS_SUAS_SALAS) ?? 'null')
  } catch {
    return []
  }
  if (cru === null || typeof cru !== 'object' || Array.isArray(cru)) return []
  const { versao, salas } = cru as { versao?: unknown; salas?: unknown }
  if (versao !== VERSAO || !Array.isArray(salas)) return []
  return salas
    .filter(ehSalaLembrada)
    .filter((sala) => agora - sala.em < ESQUECER_DEPOIS_MS)
    .sort((a, b) => b.em - a.em)
    .slice(0, LIMITE_DE_SUAS_SALAS)
}

function gravar(salas: SalaLembrada[]): void {
  try {
    localStorage.setItem(CHAVE_DAS_SUAS_SALAS, JSON.stringify({ versao: VERSAO, salas }))
  } catch {
    // Armazenamento bloqueado: a lista só não lembra. A Sala continua no link.
  }
}

/**
 * Põe a Sala no topo. `slugAnterior` é o de antes de alguém mudar o nome: o item é o mesmo, e
 * não um segundo apontando para um slug que não existe mais.
 */
export function lembrarSala(sala: Omit<SalaLembrada, 'em'>, slugAnterior?: string, agora = Date.now()): void {
  const fora = new Set([sala.slug, slugAnterior])
  const resto = lerSuasSalas(agora).filter((item) => !fora.has(item.slug))
  gravar([{ ...sala, em: agora }, ...resto].slice(0, LIMITE_DE_SUAS_SALAS))
}

export function esquecerSala(slug: string): void {
  gravar(lerSuasSalas().filter((item) => item.slug !== slug))
}

export function salaLembrada(slug: string): SalaLembrada | null {
  return lerSuasSalas().find((item) => item.slug === slug) ?? null
}
