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

type Ouvinte = (...dados: unknown[]) => void

/** Os ouvintes de cada sala falsa, para o teste poder disparar o que o SDK dispararia. */
const ouvintes = new WeakMap<object, Map<string, Set<Ouvinte>>>()

export function salaFalsa(eu: ParticipanteFalso, outros: ParticipanteFalso[] = []): Room {
  const meus = new Map<string, Set<Ouvinte>>()
  const sala = {
    localParticipant: eu,
    remoteParticipants: new Map(outros.map((participante) => [participante.identity, participante])),
    on(evento: string, ouvinte: Ouvinte) {
      if (!meus.has(evento)) meus.set(evento, new Set())
      meus.get(evento)?.add(ouvinte)
      return this
    },
    off(evento: string, ouvinte: Ouvinte) {
      meus.get(evento)?.delete(ouvinte)
      return this
    },
  }
  ouvintes.set(sala, meus)
  return sala as unknown as Room
}

/** O que o SDK entregaria àquele evento — `DataReceived`, por exemplo. */
export function emitirNaSala(sala: Room, evento: string, ...dados: unknown[]): void {
  for (const ouvinte of ouvintes.get(sala as unknown as object)?.get(evento) ?? []) ouvinte(...dados)
}
