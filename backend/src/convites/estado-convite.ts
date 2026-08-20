export type EstadoConvite = 'valido' | 'expirado' | 'revogado' | 'esgotado'

export interface DadosConvite {
  expiraEm: Date
  revogadoEm: Date | null
  usos: number
  usosMax: number | null
}

/**
 * Prioridade quando mais de uma condição vale ao mesmo tempo (ex.: convite revogado depois de
 * já expirado): revogação é uma ação explícita do admin, então tem precedência sobre os
 * estados que o tempo/uso teriam produzido sozinhos.
 */
export function calcularEstado(convite: DadosConvite, agora = new Date()): EstadoConvite {
  if (convite.revogadoEm) return 'revogado'
  if (convite.expiraEm.getTime() <= agora.getTime()) return 'expirado'
  if (convite.usosMax !== null && convite.usos >= convite.usosMax) return 'esgotado'
  return 'valido'
}
