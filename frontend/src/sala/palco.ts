import {
  ConnectionQuality,
  ConnectionState,
  Track,
  type Participant,
  type Room,
  type TrackPublication,
} from 'livekit-client'
import type { EstadoDaRecepcao } from './recepcao'

/**
 * O palco: tudo que existe na sala, extraído do estado do `Room` a cada mudança.
 *
 * Telas e pessoas são listas separadas de propósito. Compartilhamento simultâneo é caso normal
 * nesta sala, não exceção, e quase toda regra do palco pergunta por *telas*, não por peças: é a
 * primeira tela que assume o foco ao entrar, é uma tela que promove a próxima quando a peça em
 * foco sai, e é a sua tela nova que põe você no palco. Com as duas coisas na mesma lista, cada
 * uma dessas perguntas viraria um filtro repetido.
 */
export interface Peca {
  chave: string
  identidade: string
  nome: string
  ehTela: boolean
  proprio: boolean
  /** A imagem. Só a tela a carrega — pessoa nunca tem imagem, e por isso nunca vira quadro. */
  publicacao?: TrackPublication
  microfoneLigado: boolean
  falando: boolean
  /**
   * Há som vindo deste quadro — a voz, no quadro de pessoa; o som da tela, no de tela. É o que
   * decide se existe volume a regular. Vale pela *publicação*, não pelo mudo de quem manda:
   * mudo vai e volta o tempo todo, e o controle não pode piscar junto.
   */
  temAudio: boolean
  /** A publicação do som daquela tela; é dela que sai o nível do indicador, não de `publicacao`. */
  publicacaoDoAudio?: TrackPublication
  /** O veredito do cão de guarda da recepção; só existe em tela alheia — a própria não se assina. */
  recepcao?: EstadoDaRecepcao
  /** A Tela está publicada, mas muda: quem compartilha parou de mandar quadros (o navegador pausou a captura). */
  pausada?: boolean
  /** A conexão do dono da peça, como o SFU a mede. */
  qualidade?: ConnectionQuality
  /** Esta pessoa escolheu não ver esta Tela: está desassinada, e volta com um clique. */
  naoVejo?: boolean
  /**
   * A Tela saiu do ar enquanto estava em destaque. A peça fica no palco, sem imagem, até alguém
   * fechar o cartão ou a mesma pessoa voltar a compartilhar — quem desenha é que a cria.
   */
  encerrada?: boolean
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
 * Mudo vai e volta: o navegador pausa a captura e a devolve, e o LiveKit sinaliza isso como
 * mudo. O palco mostra a tela muda como pausada, mas é a publicação, e não a imagem, que
 * distingue voltar do mudo de começar a compartilhar — uma tela própria "nova" arrancaria o foco
 * de quem tinha escolhido assistir outra coisa.
 */
export function chavesDasTelasPublicadas(sala: Room | null): string[] {
  if (!sala) return []
  const participantes: Participant[] = [sala.localParticipant, ...sala.remoteParticipants.values()]
  return participantes
    .filter((participante) => participante.getTrackPublication(Track.Source.ScreenShare))
    .map((participante) => chaveDaTela(participante.identity))
}

export function montarPalco(
  sala: Room | null,
  recepcao?: ReadonlyMap<string, EstadoDaRecepcao>,
  naoVejo?: ReadonlySet<string>,
): Palco {
  if (!sala) return PALCO_VAZIO

  const telas: Peca[] = []
  const pessoas: Peca[] = []
  // A ordem importa: `decidirFoco` promove `palco.telas[0]` quando o palco fica vago. Você
  // primeiro, e depois os outros na ordem em que o SDK os conheceu — a sua tela é a que você
  // mais quer ver assumir, e entre as alheias não há carimbo de hora para ordenar.
  const participantes: Participant[] = [sala.localParticipant, ...sala.remoteParticipants.values()]

  for (const participante of participantes) {
    const proprio = participante.identity === sala.localParticipant.identity
    const microfone = participante.getTrackPublication(Track.Source.Microphone)
    const tela = participante.getTrackPublication(Track.Source.ScreenShare)
    const somDaTela = participante.getTrackPublication(Track.Source.ScreenShareAudio)

    pessoas.push({
      chave: `pessoa:${participante.identity}`,
      identidade: participante.identity,
      nome: nomeDoParticipante(participante),
      ehTela: false,
      proprio,
      microfoneLigado: Boolean(microfone && !microfone.isMuted),
      falando: participante.isSpeaking,
      temAudio: Boolean(microfone),
    })

    // A tela muda continua sendo quadro: some a imagem, fica o cartão dizendo que está pausada.
    if (tela) {
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
        publicacaoDoAudio: somDaTela,
        recepcao: proprio ? undefined : recepcao?.get(participante.identity),
        pausada: tela.isMuted,
        qualidade: participante.connectionQuality,
        naoVejo: !proprio && Boolean(naoVejo?.has(participante.identity)),
      })
    }
  }

  return { telas, pessoas }
}

/**
 * O que o quadro está dizendo a quem olha para ele, além da imagem.
 *
 * A ordem é a do que explica mais: a própria conexão caída explica tudo o que não chega; uma
 * Tela que terminou não tem mais o que pausar; a que a pessoa escolheu não ver não chega porque
 * ela pediu; a conexão do dono caída explica a imagem parada
 * dele; pausada é a imagem parada de propósito; e só então vem o que o cão de guarda viu.
 */
export type EstadoDoQuadro =
  | 'aoVivo'
  | 'voceReconectando'
  | 'terminou'
  | 'naoVejo'
  | 'donoReconectando'
  | 'pausada'
  | 'chegando'
  | 'nuncaChegou'
  | 'congelada'

export function estadoDoQuadro(peca: Peca, minhaConexao: ConnectionState): EstadoDoQuadro {
  if (minhaConexao !== ConnectionState.Connected) return 'voceReconectando'
  if (peca.encerrada) return 'terminou'
  if (peca.naoVejo) return 'naoVejo'
  if (!peca.proprio && peca.qualidade === ConnectionQuality.Lost) return 'donoReconectando'
  if (peca.pausada) return 'pausada'
  switch (peca.recepcao) {
    case 'retomando':
      return 'chegando'
    case 'desistiu':
      return 'nuncaChegou'
    case 'congelada':
      return 'congelada'
    default:
      return 'aoVivo'
  }
}

/** A peça que fica no palco quando a Tela em destaque sai do ar: a mesma chave, sem imagem. */
export function pecaEncerrada(peca: Peca): Peca {
  return {
    ...peca,
    publicacao: undefined,
    publicacaoDoAudio: undefined,
    temAudio: false,
    recepcao: undefined,
    pausada: false,
    naoVejo: false,
    encerrada: true,
  }
}
