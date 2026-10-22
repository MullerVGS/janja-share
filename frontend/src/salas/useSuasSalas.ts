import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { esquecerSala, lerSuasSalas, type SalaLembrada } from './suasSalas'

/**
 * "Suas salas" para quem desenha: relida a cada troca de endereço (entrar numa Sala a põe no
 * topo) e quando outra aba deste navegador mexe na lista.
 */
export function useSuasSalas(): { salas: SalaLembrada[]; esquecer(slug: string): void } {
  const { pathname, search } = useLocation()
  const [salas, setSalas] = useState(() => lerSuasSalas())

  useEffect(() => {
    setSalas(lerSuasSalas())
  }, [pathname, search])

  useEffect(() => {
    const aoMudar = () => setSalas(lerSuasSalas())
    window.addEventListener('storage', aoMudar)
    return () => window.removeEventListener('storage', aoMudar)
  }, [])

  const esquecer = useCallback((slug: string) => {
    esquecerSala(slug)
    setSalas(lerSuasSalas())
  }, [])

  return { salas, esquecer }
}
