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
 *
 * São as telas **publicadas**, mudas incluídas (`chavesDasTelasPublicadas`), e não as que estão
 * no palco: o palco esconde a tela muda, e mudo vai e volta — contar só o palco faria o desmudar
 * parecer uma tela nova.
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

/**
 * A tela que assume o palco quando ninguém o ocupa. É `palco.telas[0]`, e essa ordem é a que
 * `montarPalco` produz: a **sua** tela primeiro, se você estiver compartilhando, e depois as dos
 * outros na ordem em que entraram na sala — não há carimbo de hora de quando cada tela subiu, e
 * inventar um pediria estado que este módulo não tem.
 */
function primeiraTela(palco: Palco): EstadoDoFoco | null {
  const primeira = palco.telas[0]
  return primeira ? { chave: primeira.chave, soltoPelaPessoa: false } : null
}

function aoMudarPalco(estado: EstadoDoFoco, palco: Palco, telasAntes: string[]): EstadoDoFoco {
  const propria = telaPropriaNova(palco, telasAntes)
  if (propria !== null) return { chave: propria, soltoPelaPessoa: false }

  if (estado.chave !== null) {
    if (existeNoPalco(palco, estado.chave)) return estado // tela nova não rouba de quem está em foco
    // A peça em foco sumiu. Quem estava assistindo uma tela quer continuar assistindo uma tela:
    // a próxima viva assume aqui mesmo, na mesma passada, senão a pessoa ficaria parada na grade
    // com uma tela no ar esperando um evento que pode não vir. Sem tela nenhuma, é a grade — sem
    // marcar soltoPelaPessoa, porque ela não escolheu sair, e é essa marca falsa que impediria a
    // próxima tela a subir de assumir o palco sozinha.
    return primeiraTela(palco) ?? { chave: null, soltoPelaPessoa: false }
  }

  if (estado.soltoPelaPessoa) return estado // quem foi para a grade de propósito só volta por clique

  return primeiraTela(palco) ?? estado
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
