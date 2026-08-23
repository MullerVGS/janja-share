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
 * quem guardou é responsável por parar as faixas.
 */

let pendente: LocalTrack[] | null = null

export function guardarCaptura(faixas: LocalTrack[]): void {
  pendente = faixas
}

export function retirarCaptura(): LocalTrack[] | null {
  const faixas = pendente
  pendente = null
  return faixas
}
