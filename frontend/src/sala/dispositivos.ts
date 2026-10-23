import type { Room } from 'livekit-client'

/** Os dois aparelhos de som que a pessoa escolhe: por onde a voz entra e por onde a Sala sai. */
export type TipoDeDispositivo = 'microfone' | 'saida'

export interface Dispositivo {
  id: string
  nome: string
}

/** O "padrão do sistema" é a escolha vazia: nenhuma restrição, o navegador segue o sistema. */
export const PADRAO_DO_SISTEMA = ''

const TIPO_DO_NAVEGADOR: Record<TipoDeDispositivo, MediaDeviceKind> = {
  microfone: 'audioinput',
  saida: 'audiooutput',
}

/**
 * Os aparelhos de um tipo, como a pessoa os reconhece.
 *
 * `default` e `communications` são apelidos do Chrome para um aparelho que já está na lista —
 * mostrá-los seria o mesmo fone duas vezes com nomes diferentes; o "padrão do sistema" já é o
 * `default`. Sem a permissão do microfone o navegador esconde os nomes (e às vezes os ids):
 * sem id não há o que escolher, e sem nome fica a posição.
 */
export function dispositivosDoTipo(lista: MediaDeviceInfo[], tipo: TipoDeDispositivo): Dispositivo[] {
  const rotulo = tipo === 'microfone' ? 'Microfone' : 'Saída'
  return lista
    .filter((item) => item.kind === TIPO_DO_NAVEGADOR[tipo])
    .filter((item) => item.deviceId !== '' && item.deviceId !== 'default' && item.deviceId !== 'communications')
    .map((item, indice) => ({ id: item.deviceId, nome: item.label || `${rotulo} ${indice + 1}` }))
}

/** O navegador deixa escolher a saída? O Safari não deixa; sem `setSinkId` o som sai pelo padrão. */
export function escolheSaida(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
}

export async function listarDispositivos(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    return await navigator.mediaDevices.enumerateDevices()
  } catch {
    return []
  }
}

/**
 * As opções da Sala para os aparelhos guardados. O microfone vai como preferência e não como
 * exigência: o fone que ficou na gaveta não pode impedir a pessoa de falar — o navegador cai no
 * padrão. A saída, se o aparelho sumiu, o `setSinkId` falha e o som segue no padrão.
 */
export function opcoesDeDispositivos(microfone: string, saida: string) {
  return {
    ...(microfone !== PADRAO_DO_SISTEMA && { audioCaptureDefaults: { deviceId: microfone } }),
    ...(saida !== PADRAO_DO_SISTEMA && escolheSaida() && { audioOutput: { deviceId: saida } }),
  }
}

/**
 * Troca o aparelho na Sala conectada. O microfone aberto é reiniciado no aparelho novo; o fechado
 * só troca quando abrir de novo. O padrão do microfone é o `default`, que no Firefox não existe e,
 * como preferência, vira o padrão do sistema; o da saída é o id vazio da especificação.
 */
export async function trocarNaSala(sala: Room, tipo: TipoDeDispositivo, id: string): Promise<void> {
  if (tipo === 'microfone') {
    await sala.switchActiveDevice('audioinput', id === PADRAO_DO_SISTEMA ? 'default' : id, false)
    return
  }
  await sala.switchActiveDevice('audiooutput', id)
}
