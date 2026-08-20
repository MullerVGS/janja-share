import { Track, type Participant, type Room, type TrackPublication } from 'livekit-client'

/**
 * O palco: o que a grade desenha, extraído do estado do `Room` a cada mudança.
 *
 * Telas e pessoas são listas separadas de propósito. Compartilhamento simultâneo é caso normal
 * nesta sala, não exceção, e o layout precisa poder dar todo o espaço às telas e empurrar as
 * pessoas para uma tira — coisa impossível se as duas coisas vivessem na mesma lista.
 */
export interface Peca {
  chave: string
  identidade: string
  nome: string
  ehTela: boolean
  proprio: boolean
  /** Ausente quando não há o que desenhar (câmera fechada, tela ainda não assinada). */
  publicacao?: TrackPublication
  microfoneLigado: boolean
  falando: boolean
}

export interface Palco {
  telas: Peca[]
  pessoas: Peca[]
}

const PALCO_VAZIO: Palco = { telas: [], pessoas: [] }

function nomeDe(participante: Participant): string {
  return participante.name?.trim() || participante.identity
}

export function montarPalco(sala: Room | null): Palco {
  if (!sala) return PALCO_VAZIO

  const telas: Peca[] = []
  const pessoas: Peca[] = []
  const participantes: Participant[] = [sala.localParticipant, ...sala.remoteParticipants.values()]

  for (const participante of participantes) {
    const proprio = participante.identity === sala.localParticipant.identity
    const camera = participante.getTrackPublication(Track.Source.Camera)
    const microfone = participante.getTrackPublication(Track.Source.Microphone)
    const tela = participante.getTrackPublication(Track.Source.ScreenShare)

    pessoas.push({
      chave: `pessoa:${participante.identity}`,
      identidade: participante.identity,
      nome: nomeDe(participante),
      ehTela: false,
      proprio,
      publicacao: camera && !camera.isMuted ? camera : undefined,
      microfoneLigado: Boolean(microfone && !microfone.isMuted),
      falando: participante.isSpeaking,
    })

    if (tela && !tela.isMuted) {
      telas.push({
        chave: `tela:${participante.identity}`,
        identidade: participante.identity,
        nome: nomeDe(participante),
        ehTela: true,
        proprio,
        publicacao: tela,
        microfoneLigado: false,
        falando: false,
      })
    }
  }

  return { telas, pessoas }
}

/** Iniciais para o círculo de quem está sem câmera. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const primeira = partes[0] as string
  if (partes.length === 1) return primeira.slice(0, 2).toUpperCase()
  return `${primeira[0] ?? ''}${(partes[partes.length - 1] as string)[0] ?? ''}`.toUpperCase()
}
