import { useEffect, useRef, useState } from 'react'

/** O aviso de volta do segundo plano fica o bastante para ser lido. */
export const AVISO_DE_VOLTA_MS = 8000

export const FRASE_DE_VOLTA =
  'A aba ficou em segundo plano e o celular pode ter pausado a imagem. Buscamos as telas de novo.'

type Trava = { release(): Promise<void> }

/**
 * Quem assiste pelo celular (ticket 03): a tela não apaga enquanto há uma Tela alheia à mostra
 * (Wake Lock), e a aba que volta do segundo plano busca a mídia de novo sozinha e diz por quê. A
 * religação da Sala, se ela caiu lá atrás, é a de sempre (ADR 0007).
 *
 * A busca e o aviso só valem em aparelho de toque: no computador, trocar de aba não pausa nada.
 */
export function useCelularAssistindo({
  assistindo,
  conectada,
  aoVoltar,
}: {
  assistindo: boolean
  conectada: boolean
  aoVoltar(): void
}): string | null {
  const [aviso, setAviso] = useState(false)
  const trava = useRef<Trava | null>(null)
  const atuais = useRef({ conectada, aoVoltar, assistindo })
  atuais.current = { conectada, aoVoltar, assistindo }

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(tipo: 'screen'): Promise<Trava> } }).wakeLock
    if (!assistindo || !wakeLock) return
    let ativo = true
    const pedir = () => {
      if (document.visibilityState !== 'visible' || trava.current) return
      wakeLock
        .request('screen')
        .then((nova) => {
          if (ativo) trava.current = nova
          else void nova.release()
        })
        .catch(() => {
          // Bateria fraca ou o navegador recusou: a tela pode apagar, nada mais.
        })
    }
    pedir()
    const aoMudar = () => {
      // O navegador solta a trava sozinho ao esconder a aba; ao voltar, pede de novo.
      if (document.visibilityState === 'hidden') trava.current = null
      else pedir()
    }
    document.addEventListener('visibilitychange', aoMudar)
    return () => {
      ativo = false
      document.removeEventListener('visibilitychange', aoMudar)
      void trava.current?.release()
      trava.current = null
    }
  }, [assistindo])

  useEffect(() => {
    const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false
    let escondidaAssistindo = false
    let some: ReturnType<typeof setTimeout> | undefined
    const aoMudar = () => {
      if (document.visibilityState === 'hidden') {
        escondidaAssistindo = atuais.current.assistindo
        return
      }
      if (!escondidaAssistindo) return
      escondidaAssistindo = false
      // No computador, trocar de aba não pausa nada: reassinar ali só piscaria a imagem.
      if (!toque) return
      if (atuais.current.conectada) atuais.current.aoVoltar()
      setAviso(true)
      clearTimeout(some)
      some = setTimeout(() => setAviso(false), AVISO_DE_VOLTA_MS)
    }
    document.addEventListener('visibilitychange', aoMudar)
    return () => {
      document.removeEventListener('visibilitychange', aoMudar)
      clearTimeout(some)
    }
  }, [])

  return aviso ? FRASE_DE_VOLTA : null
}
