/**
 * A Sala em que a pessoa está, como a casca a desenha: no trilho (o ícone aceso), na coluna (a
 * sala escolhida, com quem está dentro) e no painel de voz. Quem monta é a tela da Sala, a
 * partir do `Room` — mais fresco que a lista do servidor, que chega a cada 5 s.
 */
export interface SalaAtual {
  slug: string
  nome: string
  privada: boolean
  fixa: boolean
  assinatura: string | null
  pessoas: PessoaNaColuna[]
  /** A página mostra a chamada (e não o saguão, aberto por cima de uma sala conectada). */
  aMostra: boolean
}

/** Uma linha de pessoa dentro de uma sala da coluna. */
export interface PessoaNaColuna {
  chave: string
  nome: string
  aoVivo: boolean
  microfoneAberto: boolean
  falando?: boolean
  proprio?: boolean
  /** O SFU perdeu esta pessoa, ou ela disse que a rede está fraca (ticket 03). */
  comProblema?: boolean
}
