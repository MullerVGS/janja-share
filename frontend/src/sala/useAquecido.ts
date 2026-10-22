import { useEffect, useState } from 'react'

/**
 * Se já passou `ms` desde que `chave` apareceu. Cada chave nova recomeça a contagem; `null` é
 * "nada para aquecer" e responde `false`.
 */
export function useAquecido(chave: string | null, ms: number): boolean {
  const [aquecida, setAquecida] = useState<string | null>(null)

  useEffect(() => {
    if (chave === null) return
    const espera = setTimeout(() => setAquecida(chave), ms)
    return () => clearTimeout(espera)
  }, [chave, ms])

  return chave !== null && aquecida === chave
}
