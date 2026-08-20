import { Track, type TrackPublication } from 'livekit-client'
import { vi } from 'vitest'
import type { Peca } from '../../src/sala/palco'
import type { ControleDeVolumes } from '../../src/sala/useVolumes'
import { volumeDe, type Volumes } from '../../src/sala/volumes'
import { publicacaoFalsa } from './salaFalsa'

/** Uma peça do palco pelo nome de quem a publica; `ehTela` já traz a publicação que a põe lá. */
export function peca(nome: string, parcial: Partial<Peca> = {}): Peca {
  const ehTela = parcial.ehTela ?? false
  return {
    chave: `${ehTela ? 'tela' : 'pessoa'}:${nome}`,
    identidade: nome.toLowerCase(),
    nome,
    ehTela,
    proprio: false,
    publicacao: ehTela ? (publicacaoFalsa(Track.Source.ScreenShare) as unknown as TrackPublication) : undefined,
    microfoneLigado: true,
    falando: false,
    temAudio: true,
    ...parcial,
  }
}

export function volumesFalsos(guardados: Volumes = {}): ControleDeVolumes {
  return {
    volumeDe: (nome, tipo) => volumeDe(guardados, nome, tipo),
    definir: vi.fn(),
    alternarMudo: vi.fn(),
  }
}
