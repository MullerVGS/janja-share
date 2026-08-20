import { useEffect, useRef } from 'react'
import { Track, type Room, type TrackPublication } from 'livekit-client'

/**
 * Um `<video>` amarrado a uma faixa do LiveKit.
 *
 * O `attach`/`detach` é o contrato do SDK e precisa acontecer nos dois sentidos: um `detach`
 * esquecido mantém o elemento consumindo a faixa depois que o quadro sumiu da tela.
 */
export function Video({
  publicacao,
  className,
  espelhar = false,
}: {
  publicacao?: TrackPublication
  className?: string
  espelhar?: boolean
}) {
  const referencia = useRef<HTMLVideoElement>(null)
  const faixa = publicacao?.track

  useEffect(() => {
    const elemento = referencia.current
    if (!faixa || !elemento) return
    faixa.attach(elemento)
    return () => {
      faixa.detach(elemento)
    }
  }, [faixa])

  return (
    <video
      ref={referencia}
      className={className}
      autoPlay
      playsInline
      // O áudio nunca vem junto do vídeo no LiveKit (publicação separada); um `<video>` com som
      // aqui só produziria eco da própria voz.
      muted
      style={espelhar ? { transform: 'scaleX(-1)' } : undefined}
    />
  )
}

function AudioDeUmaFaixa({ publicacao }: { publicacao: TrackPublication }) {
  const referencia = useRef<HTMLAudioElement>(null)
  const faixa = publicacao.track

  useEffect(() => {
    const elemento = referencia.current
    if (!faixa || !elemento) return
    faixa.attach(elemento)
    return () => {
      faixa.detach(elemento)
    }
  }, [faixa])

  return <audio ref={referencia} autoPlay />
}

/**
 * Todo o áudio remoto da sala num canto invisível — voz e áudio de tela.
 *
 * Fica fora da grade de propósito: quem está falando não precisa ter quadro na tela para ser
 * ouvido, e uma tela em destaque não pode levar o som de ninguém embora ao ser fixada.
 */
export function AudioDaSala({ sala }: { sala: Room | null }) {
  if (!sala) return null

  const publicacoes: TrackPublication[] = []
  for (const participante of sala.remoteParticipants.values()) {
    for (const publicacao of participante.getTrackPublications()) {
      if (publicacao.kind === Track.Kind.Audio && publicacao.track) publicacoes.push(publicacao)
    }
  }

  return (
    <div hidden>
      {publicacoes.map((publicacao) => (
        <AudioDeUmaFaixa key={publicacao.trackSid} publicacao={publicacao} />
      ))}
    </div>
  )
}
