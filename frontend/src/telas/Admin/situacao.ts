import type { Convite } from '../../api/convites'

export type Situacao = 'ativo' | 'revogado' | 'expirado' | 'esgotado'

/**
 * Por que um convite não serve mais.
 *
 * O contrato entrega `ativo` como booleano — suficiente para o backend, insuficiente para o
 * painel: "revogado", "expirado" e "esgotado" pedem providências diferentes de quem administra.
 * A ordem importa: um convite revogado que também expirou é, antes de tudo, revogado.
 */
export function situacaoDoConvite(convite: Convite, agora: number = Date.now()): Situacao {
  if (convite.revogadoEm !== null) return 'revogado'
  if (new Date(convite.expiraEm).getTime() <= agora) return 'expirado'
  if (convite.usosMax !== null && convite.usos >= convite.usosMax) return 'esgotado'
  return 'ativo'
}

export const FRASE_DA_SITUACAO: Record<Situacao, string> = {
  ativo: 'ativo',
  revogado: 'revogado',
  expirado: 'expirado',
  esgotado: 'esgotado',
}
