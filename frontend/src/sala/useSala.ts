import { useEffect, useState } from 'react'
import { ConnectionState, Room, RoomEvent } from 'livekit-client'
import type { Credenciais } from '../api/convites'

/**
 * Conecta na sala e mantém a UI em dia com o SDK.
 *
 * O estado de quem está publicando o quê já vive dentro do `Room`; duplicá-lo em `useState`
 * criaria duas verdades que divergem no primeiro evento perdido. Em vez disso, cada evento
 * relevante só incrementa `versao` — a árvore re-renderiza e lê o `Room` de novo, que é a
 * única fonte.
 */
const EVENTOS_DO_PALCO: RoomEvent[] = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged,
]

export interface EstadoDaSala {
  sala: Room | null
  conexao: ConnectionState
  /** Falha fatal de conexão — o `connect` que nunca completou. */
  erro: string | null
  /** Muda a cada evento do palco; existe para forçar a releitura do `Room`. */
  versao: number
  /** O Chrome bloqueia áudio antes de um gesto do usuário; quando bloqueia, isto fica falso. */
  audioLiberado: boolean
  liberarAudio(): void
}

export function useSala(credenciais: Credenciais | null): EstadoDaSala {
  const [sala, setSala] = useState<Room | null>(null)
  const [conexao, setConexao] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const [audioLiberado, setAudioLiberado] = useState(true)

  useEffect(() => {
    if (!credenciais) return

    const nova = new Room({
      adaptiveStream: true,
      // Dynacast desliga no servidor as camadas que ninguém está assistindo — numa sala de
      // cinco pessoas com várias telas no ar, é o que evita subir uplink para ninguém.
      dynacast: true,
    })

    const marcar = () => setVersao((v) => v + 1)
    for (const evento of EVENTOS_DO_PALCO) nova.on(evento, marcar)
    nova.on(RoomEvent.ConnectionStateChanged, (estado) => setConexao(estado))
    nova.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioLiberado(nova.canPlaybackAudio))

    setSala(nova)
    setConexao(ConnectionState.Connecting)
    setErro(null)

    nova
      .connect(credenciais.urlSfu, credenciais.token)
      .then(() => setAudioLiberado(nova.canPlaybackAudio))
      .catch((falha: unknown) => setErro(falha instanceof Error ? falha.message : String(falha)))

    return () => {
      nova.removeAllListeners()
      void nova.disconnect()
      setSala(null)
    }
  }, [credenciais])

  return {
    sala,
    conexao,
    erro,
    versao,
    audioLiberado,
    liberarAudio: () => {
      void sala?.startAudio().then(() => setAudioLiberado(true))
    },
  }
}
