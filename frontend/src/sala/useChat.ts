import { useCallback, useEffect, useRef, useState } from 'react'
import { RoomEvent, type Room } from 'livekit-client'
import {
  desempacotar,
  empacotar,
  inserirEmOrdem,
  novaIdentidadeLocal,
  LIMITE_DO_TEXTO,
  type MensagemNaTela,
} from './chat'

/** Tópico do data channel. Marcar o tópico é o que deixa outro uso do canal conviver sem virar chat. */
export const TOPICO_DO_CHAT = 'chat'

export interface Chat {
  mensagens: MensagemNaTela[]
  enviar(texto: string): Promise<void>
  falhaAoEnviar: string | null
}

/**
 * Chat sobre o data channel do LiveKit, em modo `reliable`.
 *
 * A mensagem própria entra na lista localmente: `publishData` não ecoa de volta para quem
 * enviou, então sem isto quem escreve nunca veria o que escreveu.
 */
export function useChat(sala: Room | null, nomeProprio: string): Chat {
  const [mensagens, setMensagens] = useState<MensagemNaTela[]>([])
  const [falhaAoEnviar, setFalhaAoEnviar] = useState<string | null>(null)
  const nome = useRef(nomeProprio)
  nome.current = nomeProprio

  useEffect(() => {
    if (!sala) return

    const receber = (dados: Uint8Array, _remetente?: unknown, _tipo?: unknown, topico?: string) => {
      if (topico !== undefined && topico !== TOPICO_DO_CHAT) return
      const mensagem = desempacotar(dados)
      if (!mensagem) return
      setMensagens((atuais) =>
        inserirEmOrdem(atuais, { ...mensagem, id: novaIdentidadeLocal(), propria: false }),
      )
    }

    sala.on(RoomEvent.DataReceived, receber)
    return () => {
      sala.off(RoomEvent.DataReceived, receber)
    }
  }, [sala])

  const enviar = useCallback(
    async (bruto: string) => {
      const texto = bruto.trim().slice(0, LIMITE_DO_TEXTO)
      if (texto === '' || !sala) return

      const mensagem = { nome: nome.current, texto, ts: Date.now() }
      setFalhaAoEnviar(null)
      setMensagens((atuais) =>
        inserirEmOrdem(atuais, { ...mensagem, id: novaIdentidadeLocal(), propria: true }),
      )
      try {
        await sala.localParticipant.publishData(empacotar(mensagem), {
          reliable: true,
          topic: TOPICO_DO_CHAT,
        })
      } catch (falha) {
        setFalhaAoEnviar(falha instanceof Error ? falha.message : 'não foi possível enviar')
      }
    },
    [sala],
  )

  return { mensagens, enviar, falhaAoEnviar }
}
