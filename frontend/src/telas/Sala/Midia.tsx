import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Track, type RemoteAudioTrack, type Room, type TrackPublication } from 'livekit-client'
import { nomeDoParticipante } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { VOLUME_CHEIO, type TipoDeAudio } from '../../sala/volumes'

/**
 * Um `<video>` amarrado a uma faixa do LiveKit.
 *
 * O `attach`/`detach` é o contrato do SDK e precisa acontecer nos dois sentidos: um `detach`
 * esquecido mantém o elemento consumindo a faixa depois que o quadro sumiu da tela.
 */
export function Video({
  publicacao,
  className,
  estilo,
  referencia,
}: {
  publicacao?: TrackPublication
  className?: string
  /** Onde entram as transformações da imagem: o zoom da tela e o espelho da própria câmera. */
  estilo?: CSSProperties
  /** Para quem precisa do elemento em si — a janelinha do PiP sai daqui. */
  referencia?: RefObject<HTMLVideoElement | null>
}) {
  const proprio = useRef<HTMLVideoElement>(null)
  const elementoDoVideo = referencia ?? proprio
  const faixa = publicacao?.track

  useEffect(() => {
    const elemento = elementoDoVideo.current
    if (!faixa || !elemento) return
    faixa.attach(elemento)
    return () => {
      faixa.detach(elemento)
    }
  }, [faixa, elementoDoVideo])

  return (
    <video
      ref={elementoDoVideo}
      className={className}
      autoPlay
      playsInline
      // O áudio nunca vem junto do vídeo no LiveKit (publicação separada); um `<video>` com som
      // aqui só produziria eco da própria voz.
      muted
      style={estilo}
    />
  )
}

function AudioDeUmaFaixa({ faixa, volume }: { faixa: RemoteAudioTrack; volume: number }) {
  const referencia = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const elemento = referencia.current
    if (!elemento) return
    faixa.attach(elemento)
    return () => {
      faixa.detach(elemento)
    }
  }, [faixa])

  // O volume é pedido à faixa, não ao elemento: o SDK o repassa a cada `<audio>` que ela anexar
  // daqui em diante, então a escolha atravessa uma reassinatura sem ninguém precisar lembrar.
  useEffect(() => {
    faixa.setVolume(volume / VOLUME_CHEIO)
  }, [faixa, volume])

  return <audio ref={referencia} autoPlay />
}

/**
 * Todo o áudio remoto da sala num canto invisível — voz e áudio de tela.
 *
 * Fica fora da grade de propósito: quem está falando não precisa ter quadro na tela para ser
 * ouvido, e uma tela em destaque não pode levar o som de ninguém embora ao ser fixada. Como é
 * aqui que o som de fato toca, é aqui que o volume local de cada nome é aplicado.
 */
export function AudioDaSala({ sala, volumes }: { sala: Room | null; volumes: ControleDeVolumes }) {
  if (!sala) return null

  const tocando: { sid: string; faixa: RemoteAudioTrack; volume: number }[] = []
  for (const participante of sala.remoteParticipants.values()) {
    for (const publicacao of participante.getTrackPublications()) {
      if (publicacao.kind !== Track.Kind.Audio) continue
      // Só participantes remotos chegam aqui, então toda faixa de áudio é uma `RemoteAudioTrack`.
      const faixa = publicacao.audioTrack as RemoteAudioTrack | undefined
      if (!faixa) continue
      const tipo: TipoDeAudio = publicacao.source === Track.Source.ScreenShareAudio ? 'tela' : 'pessoa'
      tocando.push({
        sid: publicacao.trackSid,
        faixa,
        volume: volumes.volumeDe(nomeDoParticipante(participante), tipo),
      })
    }
  }

  return (
    <div hidden>
      {tocando.map(({ sid, faixa, volume }) => (
        <AudioDeUmaFaixa key={sid} faixa={faixa} volume={volume} />
      ))}
    </div>
  )
}
