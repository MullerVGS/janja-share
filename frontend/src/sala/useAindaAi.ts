import { useCallback, useEffect, useState } from 'react'

/** Sozinho e sem Tela por isto, a sala pergunta se ainda tem alguém aqui. */
export const SOZINHO_ANTES_DE_PERGUNTAR_MS = 30 * 60 * 1000
/** Sem resposta por isto, a pessoa sai — e a Sala fixa adormece. */
export const ESPERA_PELA_RESPOSTA_MS = 2 * 60 * 1000

/**
 * "Ainda está aí?": a aba esquecida numa Sala vazia (102 salas com uma pessoa sozinha por mais
 * de 1 h, nas métricas). `parado` é estar sozinho e sem Tela no ar; qualquer mudança disso
 * reinicia a conta. Respondeu, a conta recomeça; não respondeu, `aoDesistir`.
 */
export function useAindaAi(parado: boolean, aoDesistir: () => void): { perguntando: boolean; responder(): void } {
  const [perguntando, setPerguntando] = useState(false)
  const [rodada, setRodada] = useState(0)

  useEffect(() => {
    setPerguntando(false)
    if (!parado) return
    const pergunta = setTimeout(() => setPerguntando(true), SOZINHO_ANTES_DE_PERGUNTAR_MS)
    return () => clearTimeout(pergunta)
  }, [parado, rodada])

  useEffect(() => {
    if (!perguntando) return
    const desiste = setTimeout(aoDesistir, ESPERA_PELA_RESPOSTA_MS)
    return () => clearTimeout(desiste)
    // `aoDesistir` muda de identidade a cada render; o relógio é da pergunta.
  }, [perguntando])

  const responder = useCallback(() => {
    setPerguntando(false)
    setRodada((valor) => valor + 1)
  }, [])

  return { perguntando: perguntando && parado, responder }
}
