import { useCallback, useState } from 'react'
import type { Room } from 'livekit-client'

/**
 * A frase que a pessoa lê quando abrir o microfone não dá certo. `null` é o único caso de
 * desistência silenciosa: `AbortError` é a troca interrompida no meio, não uma decisão.
 *
 * Diferente do compartilhamento de tela, aqui `NotAllowedError` NÃO é silêncio: não existe
 * seletor nativo para cancelar — é a permissão negada, e ela persiste. Sem faixa, o botão
 * ficaria morto para sempre sem nunca dizer por quê. O nome do erro é a parte estável do
 * `DOMException`; a `message` muda com o navegador e com o idioma do sistema.
 */
export function fraseDaFalhaDoMicrofone(falha: unknown): string | null {
  const nome = falha instanceof Error ? falha.name : ''
  if (nome === 'AbortError') return null
  if (nome === 'NotAllowedError' || nome === 'SecurityError')
    return 'O navegador bloqueou o acesso ao microfone. Libere a permissão na barra de endereço e tente de novo.'
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Não encontrei o microfone neste computador.'
  if (nome === 'NotReadableError') return 'Outro programa está usando o microfone. Feche-o e tente de novo.'
  return falha instanceof Error && falha.message ? falha.message : 'Não foi possível abrir o microfone.'
}

export interface Microfone {
  ligado: boolean
  /** A troca está em andamento: o botão não aceita outro clique. */
  ocupado: boolean
  alternar(ligar?: boolean): Promise<void>
}

/**
 * O microfone desta pessoa na Sala, para os dois lugares que o mostram — a barra da chamada e o
 * painel da pessoa. O estado vem do `Room` (quem desenha re-renderiza pela `versao`); só o
 * "ocupado" é daqui. A falha vira frase para `aoFalhar`; `null` limpa a anterior.
 */
export function useMicrofone(sala: Room | null, aoFalhar: (mensagem: string | null) => void): Microfone {
  const [ocupado, setOcupado] = useState(false)
  const ligado = sala?.localParticipant.isMicrophoneEnabled ?? false

  const alternar = useCallback(
    async (ligar?: boolean) => {
      if (!sala) return
      aoFalhar(null)
      setOcupado(true)
      try {
        await sala.localParticipant.setMicrophoneEnabled(ligar ?? !sala.localParticipant.isMicrophoneEnabled)
      } catch (falha) {
        aoFalhar(fraseDaFalhaDoMicrofone(falha))
      } finally {
        setOcupado(false)
      }
    },
    [sala, aoFalhar],
  )

  return { ligado, ocupado: ocupado || sala === null, alternar }
}
