import { useEffect, useState } from 'react'
import type { Room } from 'livekit-client'
import { criarColetor, TELEMETRIA_VAZIA, type Telemetria } from './coletor'

/** A telemetria da sala, atualizada a 1 Hz enquanto houver tela no ar — própria ou assinada. */
export function useTelemetria(sala: Room | null): Telemetria {
  const [telemetria, setTelemetria] = useState<Telemetria>(TELEMETRIA_VAZIA)

  useEffect(() => {
    if (!sala) return
    const parar = criarColetor(sala, setTelemetria)
    return () => {
      parar()
      setTelemetria(TELEMETRIA_VAZIA)
    }
  }, [sala])

  return telemetria
}
