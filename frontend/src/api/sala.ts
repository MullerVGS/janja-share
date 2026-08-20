import { pedir } from './cliente'

export interface ConfigPublica {
  urlSfu: string
  sala: string
}

/** Item de `GET /api/admin/sala`. Lista vazia é resposta normal: o SFU pode estar mudo. */
export interface ParticipanteVistoPeloAdmin {
  identidade: string
  nome: string
  /** `null` quando o SFU não informou a hora de entrada — melhor omitir do que inventar. */
  entrouEm: string | null
  publicandoTela: boolean
}

export function buscarConfig(): Promise<ConfigPublica> {
  return pedir<ConfigPublica>('/api/config')
}

export function verSala(): Promise<{ participantes: ParticipanteVistoPeloAdmin[] }> {
  return pedir<{ participantes: ParticipanteVistoPeloAdmin[] }>('/api/admin/sala')
}
