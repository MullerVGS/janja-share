import { useEffect, useState } from 'react'
import { ConnectionState, Room, RoomEvent } from 'livekit-client'
import type { Credenciais } from '../api/salas'

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
      // adaptiveStream pausa o vídeo de aba em segundo plano (mata o PiP) e, sem simulcast, não
      // tem camada para escolher — não traz nada aqui.
      adaptiveStream: false,
      // Dynacast desligado: com camada única (simulcast off), pausar é tudo ou nada, e o
      // encoder pausado que não retoma para quem chega depois é o quadro preto que ninguém
      // entende. O teto de bitrate e o governador já limitam o uplink — dynacast só ganhava
      // banda quando ninguém assistia, e é justamente aí que ninguém se importa.
      dynacast: false,
    })

    const marcar = () => setVersao((v) => v + 1)
    for (const evento of EVENTOS_DO_PALCO) nova.on(evento, marcar)
    // Conectar também muda o palco: é no `Connected` que o participante local ganha identidade e
    // nome. Sem marcar aqui, o próprio quadro fica em "?" até o evento seguinte do palco — que
    // numa sala em que ninguém publica nada pode não vir nunca.
    nova.on(RoomEvent.ConnectionStateChanged, (estado) => {
      setConexao(estado)
      marcar()
    })
    nova.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioLiberado(nova.canPlaybackAudio))

    setSala(nova)
    setConexao(ConnectionState.Connecting)
    setErro(null)

    // Uma sala descartada não fala mais pela UI. Sem esta guarda, o `connect` interrompido pela
    // limpeza (o StrictMode monta duas vezes em desenvolvimento) pintaria um erro de conexão
    // por cima da sala nova, que está conectando bem.
    let vivo = true

    nova
      .connect(credenciais.urlSfu, credenciais.token)
      .then(() => {
        if (vivo) setAudioLiberado(nova.canPlaybackAudio)
      })
      .catch((falha: unknown) => {
        if (vivo) setErro(falha instanceof Error ? falha.message : String(falha))
      })

    return () => {
      vivo = false
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
