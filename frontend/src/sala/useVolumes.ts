import { useCallback, useRef, useState } from 'react'
import { gravarPreferencias, lerPreferencias } from '../preferencias'
import { comVolume, volumeDe, type TipoDeAudio, type Volumes } from './volumes'

export interface ControleDeVolumes {
  volumeDe(nome: string, tipo: TipoDeAudio): number
  definir(nome: string, tipo: TipoDeAudio, volume: number): void
  /** Silencia lembrando onde estava, ou devolve o volume de antes do mudo. */
  alternarMudo(nome: string, tipo: TipoDeAudio): void
}

/**
 * Os volumes locais em memória, espelhados no disco a cada mexida.
 *
 * Um só destes vive na sala: o controle está no quadro e o som sai do `AudioDaSala`, e os dois
 * precisam ler o mesmo número. Por isso o estado nasce lá em cima e desce por prop.
 */
export function useVolumes(): ControleDeVolumes {
  const [volumes, setVolumes] = useState<Volumes>(() => lerPreferencias().volumes)
  // Onde o volume estava antes do mudo. Não vai ao disco de propósito: mudo que sobrevive ao
  // recarregamento é volume zero guardado, e sair dele é voltar ao som inteiro.
  const antesDoMudo = useRef<Volumes>({})

  const definir = useCallback(
    (nome: string, tipo: TipoDeAudio, volume: number) => {
      const novos = comVolume(volumes, nome, tipo, volume)
      setVolumes(novos)
      gravarPreferencias({ volumes: novos })
    },
    [volumes],
  )

  const alternarMudo = useCallback(
    (nome: string, tipo: TipoDeAudio) => {
      const atual = volumeDe(volumes, nome, tipo)
      if (atual > 0) {
        antesDoMudo.current = comVolume(antesDoMudo.current, nome, tipo, atual)
        definir(nome, tipo, 0)
        return
      }
      definir(nome, tipo, volumeDe(antesDoMudo.current, nome, tipo))
    },
    [volumes, definir],
  )

  return {
    volumeDe: useCallback((nome, tipo) => volumeDe(volumes, nome, tipo), [volumes]),
    definir,
    alternarMudo,
  }
}
