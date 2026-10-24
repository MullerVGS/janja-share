/**
 * A Tela que ninguém está vendo não vem.
 *
 * Quem assiste recebe cada Tela alheia na camada cheia, e a saída do SFU é espectadores × Telas ×
 * bitrate. As Telas fora do foco ficam na pilha, que some com o ponteiro parado, e a aba em
 * segundo plano não mostra nada: nessas horas a Tela é pausada na assinatura (o SFU para de
 * encaminhar) e religada quando volta à vista — a imagem retoma em uma ida e volta e um
 * quadro-chave, sem mexer em quem compartilha. Camada menor não existe: o SDK publica a Tela
 * VP9/AV1 com uma camada espacial só (`L1T3`), e H.264/VP8 saem sem simulcast.
 *
 * Voltar à vista religa na hora; sair espera um respiro, porque cada religada pede um
 * quadro-chave a quem compartilha, e ele vai para a Sala inteira.
 */

export const RESPIRO_DA_PILHA_MS = 15_000
export const RESPIRO_DA_ABA_MS = 60_000

/** Por que a Tela não está à vista — e daí quanto esperar antes de pausá-la. */
export type ForaDeVista = 'pilha' | 'aba'

export const RESPIRO: Record<ForaDeVista, number> = { pilha: RESPIRO_DA_PILHA_MS, aba: RESPIRO_DA_ABA_MS }

export interface Vista {
  /** A identidade de quem tem o quadro em foco; `null` é a grade, onde todos os quadros aparecem. */
  foco: string | null
  /** A pilha do foco está à mostra (segue a interface flutuante). */
  pilhaVisivel: boolean
  /** A aba da Sala está à vista. */
  abaVisivel: boolean
  /** A Tela em foco está na janelinha (PiP), que se vê com a aba escondida. */
  janelinha: boolean
}

/** `null` quando a Tela daquela pessoa está à vista; senão, o porquê. */
export function foraDeVista(identidade: string, vista: Vista): ForaDeVista | null {
  const emFoco = vista.foco === identidade
  if (emFoco && vista.janelinha) return null
  if (!vista.abaVisivel) return 'aba'
  if (vista.foco === null || emFoco) return null
  return vista.pilhaVisivel ? null : 'pilha'
}
