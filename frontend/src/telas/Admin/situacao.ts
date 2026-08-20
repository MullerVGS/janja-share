import type { Convite } from '../../api/convites'

export type Situacao = 'ativo' | 'revogado' | 'expirado' | 'esgotado'

/**
 * Por que um convite não serve mais.
 *
 * Quem decide se o convite vale é o backend, no campo `ativo` do contrato — ele é o mesmo que
 * decide se `/api/entrar` deixa passar. Recalcular a validade aqui com o relógio do navegador
 * abria a única brecha do projeto onde os dois lados podiam discordar em produção: o painel
 * dizendo "expirado" num convite que ainda deixa entrar, ou o contrário.
 *
 * O que sobra para esta função é o motivo, que o contrato não manda e o painel precisa: quem foi
 * revogado e quem esgotou os usos se leem direto dos campos (sem relógio nenhum); inativo que não
 * é nem um nem outro só pode ser prazo vencido. A ordem importa: um convite revogado que também
 * expirou é, antes de tudo, revogado.
 */
export function situacaoDoConvite(convite: Convite): Situacao {
  if (convite.revogadoEm !== null) return 'revogado'
  if (convite.ativo) return 'ativo'
  if (convite.usosMax !== null && convite.usos >= convite.usosMax) return 'esgotado'
  return 'expirado'
}
