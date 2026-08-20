import { Track, type Room } from 'livekit-client'
import { vi } from 'vitest'

/**
 * Um `Room` com o mínimo que o palco e o áudio da sala leem: participantes, publicações por
 * fonte e faixas que sabem ser anexadas e ter volume. Nada de sinalização — quem precisa de
 * SDK de verdade é o `useCompartilhamento`, que tem o seu próprio dublê.
 */

let sids = 0

export function faixaFalsa() {
  return { attach: vi.fn(), detach: vi.fn(), setVolume: vi.fn() }
}
export type FaixaFalsa = ReturnType<typeof faixaFalsa>

export interface PublicacaoFalsa {
  trackSid: string
  kind: Track.Kind
  source: Track.Source
  isMuted: boolean
  track?: FaixaFalsa
  audioTrack?: FaixaFalsa
}

const FONTES_DE_AUDIO: Track.Source[] = [Track.Source.Microphone, Track.Source.ScreenShareAudio]

export function publicacaoFalsa(
  source: Track.Source,
  opcoes: { assinada?: boolean; muda?: boolean } = {},
): PublicacaoFalsa {
  const kind = FONTES_DE_AUDIO.includes(source) ? Track.Kind.Audio : Track.Kind.Video
  const publicacao: PublicacaoFalsa = {
    trackSid: `sid-${(sids += 1)}`,
    kind,
    source,
    isMuted: opcoes.muda ?? false,
  }
  if (opcoes.assinada !== false) assinar(publicacao)
  return publicacao
}

/** A faixa chegando — é o que acontece quando a assinatura completa, já com a sala montada. */
export function assinar(publicacao: PublicacaoFalsa): PublicacaoFalsa {
  const faixa = faixaFalsa()
  publicacao.track = faixa
  if (publicacao.kind === Track.Kind.Audio) publicacao.audioTrack = faixa
  return publicacao
}

export function participanteFalso(identity: string, name: string | undefined, publicacoes: PublicacaoFalsa[] = []) {
  return {
    identity,
    name,
    isSpeaking: false,
    getTrackPublication: (fonte: Track.Source) => publicacoes.find((publicacao) => publicacao.source === fonte),
    getTrackPublications: () => publicacoes,
  }
}
export type ParticipanteFalso = ReturnType<typeof participanteFalso>

export function salaFalsa(eu: ParticipanteFalso, outros: ParticipanteFalso[] = []): Room {
  return {
    localParticipant: eu,
    remoteParticipants: new Map(outros.map((participante) => [participante.identity, participante])),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as Room
}
