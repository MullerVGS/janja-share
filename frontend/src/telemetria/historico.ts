/** 2 minutos a 1 Hz. É o que cabe num gráfico de lateral e o que o governador precisa olhar para trás. */
export const TETO_DO_HISTORICO = 120

/** Histórico de amostras: em ordem, a mais nova por último. */
export type Historico<T> = readonly T[]

export function anotar<T>(historico: Historico<T>, amostra: T, teto = TETO_DO_HISTORICO): T[] {
  const proximo = [...historico, amostra]
  return proximo.length > teto ? proximo.slice(proximo.length - teto) : proximo
}

export function ultima<T>(historico: Historico<T>): T | null {
  return historico.length === 0 ? null : (historico[historico.length - 1] as T)
}
