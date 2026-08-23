import type { LocalTrack } from 'livekit-client'

/**
 * A entrega da captura da home para a sala.
 *
 * `getDisplayMedia` exige gesto recente do usuário, e o gesto morre na navegação mais a
 * conexão com o SFU — abrir o seletor já dentro da sala custaria um segundo clique. Então o
 * seletor abre no clique da home e as faixas viajam por aqui. `MediaStreamTrack` não é
 * serializável, então não cabe no `state` do router; um módulo é o lugar honesto.
 *
 * Retirar é destrutivo de propósito: uma entrega, um consumidor. Se a sala não vier buscar,
 * quem guardou é responsável por parar as faixas — e é isso que o TTL abaixo faz sozinho,
 * sem depender de nenhum ciclo de vida do React (um `useEffect` de cleanup dispararia cedo
 * demais sob `StrictMode`, que desmonta e remonta sinteticamente antes da conexão real ter
 * qualquer chance de progredir).
 */

/**
 * Generoso o bastante para cobrir uma reconexão normal; curto o bastante para não deixar o
 * indicador do Chrome aceso por muito tempo depois que ninguém do outro lado vai aparecer. O
 * pior caso vira cair na sala sem transmitir, com "Compartilhar tela" a um clique na barra —
 * estritamente melhor que a captura ficar presa até a aba fechar.
 */
const TTL_MS = 30_000

let pendente: LocalTrack[] | null = null
let temporizador: ReturnType<typeof setTimeout> | null = null

function pararTemporizador(): void {
  if (temporizador === null) return
  clearTimeout(temporizador)
  temporizador = null
}

export function guardarCaptura(faixas: LocalTrack[]): void {
  // Guardar de novo sem ninguém ter retirado o anterior seria um vazamento permanente, não um
  // TTL: voltar pra home e compartilhar de novo enquanto a sala anterior ainda não conectou não
  // pode abandonar as faixas de antes para sempre.
  pendente?.forEach((faixa) => faixa.stop())
  pararTemporizador()
  pendente = faixas
  temporizador = setTimeout(() => {
    pendente?.forEach((faixa) => faixa.stop())
    pendente = null
    temporizador = null
  }, TTL_MS)
}

export function retirarCaptura(): LocalTrack[] | null {
  pararTemporizador()
  const faixas = pendente
  pendente = null
  return faixas
}
