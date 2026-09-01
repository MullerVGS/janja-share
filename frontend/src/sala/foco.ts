import type { Palco } from './palco'

/**
 * O foco do palco: qual quadro está em destaque.
 *
 * Há sempre um destaque quando existe algum quadro — o palco não tem mais o modo grade, e o
 * clique único na imagem passou a ser o da imersão. `chave: null` é só o estado de quem ainda
 * não escolheu (ou de uma sala sem imagem nenhuma no ar); quem desenha resolve o padrão.
 */
export interface EstadoDoFoco {
  /** Chave da peça em destaque; `null` enquanto não houver escolha nem tela a promover. */
  chave: string | null
}

export const FOCO_INICIAL: EstadoDoFoco = { chave: null }

/**
 * `palcoMudou` carrega as chaves das telas de antes da mudança — é o único jeito de
 * `decidirFoco` saber se uma tela é *nova* (para a exceção da tela própria) sem guardar
 * histórico nenhum aqui dentro; quem monta o palco já tem a lista anterior à mão.
 *
 * São as telas **publicadas**, mudas incluídas (`chavesDasTelasPublicadas`), e não as que estão
 * no palco: o palco esconde a tela muda, e mudo vai e volta — contar só o palco faria o desmudar
 * parecer uma tela nova.
 */
export type EventoDeFoco = { tipo: 'clicouNaPeca'; chave: string } | { tipo: 'palcoMudou'; telasAntes: string[] }

function existeNoPalco(palco: Palco, chave: string): boolean {
  return palco.telas.some((peca) => peca.chave === chave) || palco.pessoas.some((peca) => peca.chave === chave)
}

/**
 * A exceção da tela própria: começar a compartilhar põe você em destaque, mesmo por cima de
 * outra peça em foco. Vale nessa ordem — antes de qualquer outra regra de `palcoMudou` — porque
 * "eu comecei a compartilhar agora" é sempre mais forte do que "onde a pessoa estava olhando".
 */
function telaPropriaNova(palco: Palco, telasAntes: string[]): string | null {
  const nova = palco.telas.find((peca) => peca.proprio && !telasAntes.includes(peca.chave))
  return nova?.chave ?? null
}

/**
 * A tela que assume o destaque quando ninguém o ocupa. É `palco.telas[0]`, e essa ordem é a que
 * `montarPalco` produz: a **sua** tela primeiro, se você estiver compartilhando, e depois as dos
 * outros na ordem em que entraram na sala — não há carimbo de hora de quando cada tela subiu, e
 * inventar um pediria estado que este módulo não tem.
 */
function primeiraTela(palco: Palco): EstadoDoFoco | null {
  const primeira = palco.telas[0]
  return primeira ? { chave: primeira.chave } : null
}

function aoMudarPalco(estado: EstadoDoFoco, palco: Palco, telasAntes: string[]): EstadoDoFoco {
  const propria = telaPropriaNova(palco, telasAntes)
  if (propria !== null) return { chave: propria }

  // Tela nova não rouba de quem está em destaque.
  if (estado.chave !== null && existeNoPalco(palco, estado.chave)) return estado

  // Quem estava assistindo uma tela quer continuar assistindo uma tela: a próxima viva assume
  // aqui mesmo, na mesma passada. Sem tela nenhuma, o destaque fica vago e quem desenha decide.
  return primeiraTela(palco) ?? { chave: null }
}

export function decidirFoco(estado: EstadoDoFoco, palco: Palco, evento: EventoDeFoco): EstadoDoFoco {
  switch (evento.tipo) {
    case 'clicouNaPeca':
      return { chave: evento.chave }
    case 'palcoMudou':
      return aoMudarPalco(estado, palco, evento.telasAntes)
  }
}
