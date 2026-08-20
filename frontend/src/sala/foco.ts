import type { Palco } from './palco'

/**
 * O foco do palco: uma peça ocupando tudo, ou `null` para a grade com tudo que existe na sala.
 */
export interface EstadoDoFoco {
  /** Chave da peça no palco; `null` é a grade. */
  chave: string | null
  /** A pessoa soltou o foco de propósito (clicou na imagem). */
  soltoPelaPessoa: boolean
}

export const FOCO_INICIAL: EstadoDoFoco = { chave: null, soltoPelaPessoa: false }

/**
 * `palcoMudou` carrega as chaves das telas de antes da mudança — é o único jeito de
 * `decidirFoco` saber se uma tela é *nova* (para a exceção da tela própria) sem guardar
 * histórico nenhum aqui dentro; quem monta o palco já tem a lista anterior à mão.
 */
export type EventoDeFoco =
  | { tipo: 'clicouNoPalco' }
  | { tipo: 'clicouNaPeca'; chave: string }
  | { tipo: 'palcoMudou'; telasAntes: string[] }

function existeNoPalco(palco: Palco, chave: string): boolean {
  return palco.telas.some((peca) => peca.chave === chave) || palco.pessoas.some((peca) => peca.chave === chave)
}

/**
 * A exceção da tela própria: começar a compartilhar põe você no palco, mesmo por cima de outra
 * peça em foco e mesmo depois de ter soltado o foco de propósito. Vale nessa ordem — antes de
 * qualquer outra regra de `palcoMudou` — porque "eu comecei a compartilhar agora" é sempre mais
 * forte do que "onde a pessoa estava olhando".
 */
function telaPropriaNova(palco: Palco, telasAntes: string[]): string | null {
  const nova = palco.telas.find((peca) => peca.proprio && !telasAntes.includes(peca.chave))
  return nova?.chave ?? null
}

function aoMudarPalco(estado: EstadoDoFoco, palco: Palco, telasAntes: string[]): EstadoDoFoco {
  const propria = telaPropriaNova(palco, telasAntes)
  if (propria !== null) return { chave: propria, soltoPelaPessoa: false }

  if (estado.chave !== null) {
    if (existeNoPalco(palco, estado.chave)) return estado // tela nova não rouba de quem está em foco
    // a peça em foco sumiu — cai para a grade sem marcar soltoPelaPessoa: ela não escolheu sair,
    // e é essa marca falsa que deixa a próxima tela a subir assumir o palco sozinha.
    return { chave: null, soltoPelaPessoa: false }
  }

  if (estado.soltoPelaPessoa) return estado // quem foi para a grade de propósito só volta por clique

  const primeira = palco.telas[0]
  return primeira ? { chave: primeira.chave, soltoPelaPessoa: false } : estado
}

export function decidirFoco(estado: EstadoDoFoco, palco: Palco, evento: EventoDeFoco): EstadoDoFoco {
  switch (evento.tipo) {
    case 'clicouNoPalco':
      return { chave: null, soltoPelaPessoa: true }
    case 'clicouNaPeca':
      return { chave: evento.chave, soltoPelaPessoa: false }
    case 'palcoMudou':
      return aoMudarPalco(estado, palco, evento.telasAntes)
  }
}
