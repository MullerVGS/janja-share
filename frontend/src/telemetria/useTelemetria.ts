import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Room } from 'livekit-client'
import { criarColetor, TELEMETRIA_VAZIA, type Coletor, type Telemetria } from './coletor'

/** A telemetria da sala mais a única ação que ela oferece: rearmar o cão de guarda de uma tela. */
export interface TelemetriaDaSala extends Telemetria {
  /**
   * O "tentar de novo" do quadro que desistiu. Estável entre renders de propósito: o botão que
   * o oferece vive num quadro que se redesenha a cada amostra, uma vez por segundo.
   */
  rearmarRecepcao(identidade: string): void
}

/** A telemetria da sala, atualizada a 1 Hz enquanto houver tela no ar — própria ou assinada. */
export function useTelemetria(sala: Room | null): TelemetriaDaSala {
  const [telemetria, setTelemetria] = useState<Telemetria>(TELEMETRIA_VAZIA)
  const coletor = useRef<Coletor | null>(null)

  useEffect(() => {
    if (!sala) return
    const atual = criarColetor(sala, setTelemetria)
    coletor.current = atual
    return () => {
      coletor.current = null
      atual.parar()
      setTelemetria(TELEMETRIA_VAZIA)
    }
  }, [sala])

  const rearmarRecepcao = useCallback((identidade: string) => coletor.current?.rearmar(identidade), [])

  return useMemo(() => ({ ...telemetria, rearmarRecepcao }), [telemetria, rearmarRecepcao])
}
