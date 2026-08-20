import { ehAba, LARGURA_MINIMA_DA_LATERAL, type Aba } from './sala/lateral'

/**
 * Preferências da pessoa neste navegador: um único objeto versionado em `localStorage`.
 *
 * A leitura é tolerante campo a campo — um valor estranho vira o padrão daquele campo, não o
 * descarte do conjunto. Só a versão errada zera tudo: é o jeito de mudar o formato sem migração.
 * O nome da pessoa fica fora: ele vem do convite, não é preferência.
 */
export const CHAVE_DAS_PREFERENCIAS = 'share.preferencias'
const VERSAO = 1

export interface Preferencias {
  larguraDaLateral: number
  abaDaLateral: Aba
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  larguraDaLateral: 340,
  abaDaLateral: 'chat',
}

type Leitor<T> = (valor: unknown) => T | undefined

const LEITORES: { [C in keyof Preferencias]: Leitor<Preferencias[C]> } = {
  larguraDaLateral: (valor) =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= LARGURA_MINIMA_DA_LATERAL ? valor : undefined,
  abaDaLateral: (valor) => (ehAba(valor) ? valor : undefined),
}

export function lerPreferencias(): Preferencias {
  let cru: unknown
  try {
    cru = JSON.parse(localStorage.getItem(CHAVE_DAS_PREFERENCIAS) ?? 'null')
  } catch {
    return { ...PREFERENCIAS_PADRAO }
  }
  if (cru === null || typeof cru !== 'object' || Array.isArray(cru)) return { ...PREFERENCIAS_PADRAO }
  const guardado = cru as Record<string, unknown>
  if (guardado.versao !== VERSAO) return { ...PREFERENCIAS_PADRAO }

  const campo = <C extends keyof Preferencias>(nome: C): Preferencias[C] =>
    LEITORES[nome](guardado[nome]) ?? PREFERENCIAS_PADRAO[nome]
  return { larguraDaLateral: campo('larguraDaLateral'), abaDaLateral: campo('abaDaLateral') }
}

export function gravarPreferencias(parcial: Partial<Preferencias>): Preferencias {
  const novas = { ...lerPreferencias(), ...parcial }
  try {
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: VERSAO, ...novas }))
  } catch {
    // Armazenamento bloqueado: a preferência vale só até recarregar.
  }
  return novas
}
