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
  /**
   * Há som vindo deste quadro — a voz, no quadro de pessoa; o som da tela, no de tela. É o que
   * decide se existe volume a regular. Vale pela *publicação*, não pelo mudo de quem manda:
   * mudo vai e volta o tempo todo, e o controle não pode piscar junto.
   */
  temAudio: boolean
}

export interface Palco {
  telas: Peca[]
  pessoas: Peca[]
}

const PALCO_VAZIO: Palco = { telas: [], pessoas: [] }

/** O nome que a etiqueta mostra — e, por isso, também a chave do volume local daquele alguém. */
export function nomeDoParticipante(participante: Participant): string {
  return participante.name?.trim() || participante.identity
}

/** A chave da peça da tela de quem quer que seja — o mesmo nome que `montarPalco` dá a ela. */
function chaveDaTela(identidade: string): string {
  return `tela:${identidade}`
}

/**
 * As chaves de todas as telas **publicadas**, mudas incluídas — o `telasAntes` de `decidirFoco`.
 *
 * `montarPalco` esconde a tela muda (sem imagem não há o que pôr no palco), e mudo vai e volta:
 * o navegador pausa a captura e a devolve, e o LiveKit sinaliza isso como mudo. Comparar duas
 * fotos do palco faria o desmudar parecer uma tela nova — e uma tela própria "nova" arranca o
 * foco de quem tinha escolhido assistir outra coisa. Contar a publicação, e não a imagem, é o
 * que distingue voltar do mudo de começar a compartilhar.
 */
export function chavesDasTelasPublicadas(sala: Room | null): string[] {
  if (!sala) return []
  const participantes: Participant[] = [sala.localParticipant, ...sala.remoteParticipants.values()]
  return participantes
    .filter((participante) => participante.getTrackPublication(Track.Source.ScreenShare))
    .map((participante) => chaveDaTela(participante.identity))
}

export function montarPalco(sala: Room | null): Palco {
  if (!sala) return PALCO_VAZIO

  const telas: Peca[] = []
  const pessoas: Peca[] = []
  // A ordem importa: `decidirFoco` promove `palco.telas[0]` quando o palco fica vago. Você
  // primeiro, e depois os outros na ordem em que o SDK os conheceu — a sua tela é a que você
  // mais quer ver assumir, e entre as alheias não há carimbo de hora para ordenar.
  const participantes: Participant[] = [sala.localParticipant, ...sala.remoteParticipants.values()]

  for (const participante of participantes) {
    const proprio = participante.identity === sala.localParticipant.identity
    const camera = participante.getTrackPublication(Track.Source.Camera)
    const microfone = participante.getTrackPublication(Track.Source.Microphone)
    const tela = participante.getTrackPublication(Track.Source.ScreenShare)
    const somDaTela = participante.getTrackPublication(Track.Source.ScreenShareAudio)

    pessoas.push({
      chave: `pessoa:${participante.identity}`,
      identidade: participante.identity,
      nome: nomeDoParticipante(participante),
      ehTela: false,
      proprio,
      publicacao: camera && !camera.isMuted ? camera : undefined,
      microfoneLigado: Boolean(microfone && !microfone.isMuted),
      falando: participante.isSpeaking,
      temAudio: Boolean(microfone),
    })

    if (tela && !tela.isMuted) {
      telas.push({
        chave: chaveDaTela(participante.identity),
        identidade: participante.identity,
        nome: nomeDoParticipante(participante),
        ehTela: true,
        proprio,
        publicacao: tela,
        microfoneLigado: false,
        falando: false,
        temAudio: Boolean(somDaTela),
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
