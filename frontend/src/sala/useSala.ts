import { useEffect, useState } from 'react'
import {
  ConnectionError,
  ConnectionErrorReason,
  ConnectionState,
  CriticalTimers,
  DefaultReconnectPolicy,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type LocalTrackPublication,
  type TrackPublishOptions,
} from 'livekit-client'
import type { Credenciais } from '../api/salas'

/**
 * Quanto o SDK insiste antes de desistir de uma conexão que caiu. De fábrica são dez
 * tentativas (~44 s) — pouco para um notebook acordando ou um celular trocando de rede. Enquanto
 * ele insiste, a sessão é a mesma: quem transmitia volta transmitindo.
 */
export const ATRASOS_DA_RECONEXAO_MS: number[] = [0, 300, 1200, 2700, 4800, ...Array<number>(25).fill(7000)]

/**
 * Quando o SDK desiste, a sala religa por conta própria: `connect()` de novo, com as mesmas
 * credenciais, esperando cada vez mais entre tentativas (a última espera vale para sempre).
 */
export const ESPERAS_DO_RELIGAR_MS: number[] = [1000, 2000, 4000, 8000, 15000]

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
  // A conexão de cada um aparece no quadro dele: caiu, fraca.
  RoomEvent.ConnectionQualityChanged,
]

export interface Queda {
  tentativa: number
  comTela: boolean
}

export interface EstadoDaSala {
  sala: Room | null
  conexao: ConnectionState
  /** Falha fatal de conexão — o `connect` que nunca completou, ou uma queda de que não dá para voltar. */
  erro: string | null
  /**
   * A sala caiu e está tentando voltar sozinha; `null` quando não está caída. `comTela` diz que
   * a Tela desta pessoa ficou guardada e volta ao ar junto com a sala.
   */
  queda: Queda | null
  /** Muda a cada evento do palco; existe para forçar a releitura do `Room`. */
  versao: number
  /** O Chrome bloqueia áudio antes de um gesto do usuário; quando bloqueia, isto fica falso. */
  audioLiberado: boolean
  liberarAudio(): void
}

/**
 * O que faz o religar parar: o servidor não achou a sala (ela morreu enquanto a pessoa estava
 * fora — o SDK entrega o 404 como `NotAllowed`) ou recusou a credencial (a sessão venceu). Rede
 * fora, SFU indisponível e afins voltam `null` — insistir é a resposta certa para eles.
 */
function motivoParaDesistir(falha: unknown): string | null {
  if (!(falha instanceof ConnectionError) || falha.reason !== ConnectionErrorReason.NotAllowed) return null
  if (falha.status === 404) return 'A sala foi encerrada enquanto você estava fora.'
  return 'A sessão venceu. Entre na sala de novo.'
}

export function useSala(credenciais: Credenciais | null): EstadoDaSala {
  const [sala, setSala] = useState<Room | null>(null)
  const [conexao, setConexao] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [erro, setErro] = useState<string | null>(null)
  const [queda, setQueda] = useState<Queda | null>(null)
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
      reconnectPolicy: new DefaultReconnectPolicy(ATRASOS_DA_RECONEXAO_MS),
      // Quem para uma faixa é o app, não a despublicação. Com o padrão do SDK, a queda que ele
      // não consegue resumir parava a captura da tela junto — e voltar exigia o seletor de novo.
      // Sair da sala (`disconnect()`) continua parando tudo.
      stopLocalTrackOnUnpublish: false,
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
    setQueda(null)

    // Uma sala descartada não fala mais pela UI. Sem esta guarda, o `connect` interrompido pela
    // limpeza (o StrictMode monta duas vezes em desenvolvimento) pintaria um erro de conexão
    // por cima da sala nova, que está conectando bem.
    let vivo = true
    let espera: ReturnType<typeof setTimeout> | undefined
    const { urlSfu, token } = credenciais
    // Uma fila de tentativas por vez: o `connect` que falha faz a sala anunciar a queda de novo,
    // e cada anúncio abriria outra fila em paralelo.
    let religando = false

    // O que a queda tirou do ar sem parar — a Tela, o som dela, o microfone — volta ao ar na
    // conexão nova, com as mesmas opções. O SDK despublica tudo de uma vez, numa passada
    // síncrona que termina no `Disconnected`; as despublicações dessa passada são as que ficam
    // em `saindoAgora` até a próxima microtarefa.
    let saindoAgora: [LocalTrack, TrackPublishOptions | undefined][] = []
    const orfas = new Map<LocalTrack, TrackPublishOptions | undefined>()
    const pararOrfas = () => {
      for (const faixa of orfas.keys()) faixa.stop()
      orfas.clear()
    }
    nova.on(RoomEvent.LocalTrackUnpublished, (publicacao: LocalTrackPublication) => {
      if (!publicacao.track) return
      if (saindoAgora.length === 0) queueMicrotask(() => (saindoAgora = []))
      saindoAgora.push([publicacao.track, publicacao.options])
    })

    /**
     * Devolve ao ar o que a queda deixou vivo, na ordem em que estava (a Tela antes do som
     * dela); o que não voltar, para. Som de tela sem a Tela não volta sozinho: seria o som de
     * uma imagem que ninguém vê.
     */
    async function republicarOrfas() {
      // A ordem do SDK é a das publicações, e uma troca de codec põe a Tela atrás do som dela.
      const primeiroATela = ([faixa]: [LocalTrack, unknown]) => (faixa.source === Track.Source.ScreenShare ? 0 : 1)
      const fila = [...orfas].sort((a, b) => primeiroATela(a) - primeiroATela(b))
      orfas.clear()
      let telaFicouFora = false
      for (const [faixa, opcoes] of fila) {
        const somSemTela = faixa.source === Track.Source.ScreenShareAudio && telaFicouFora
        if (faixa.mediaStreamTrack.readyState === 'ended' || somSemTela) {
          faixa.stop()
          if (faixa.source === Track.Source.ScreenShare) telaFicouFora = true
          continue
        }
        try {
          await nova.localParticipant.publishTrack(faixa, opcoes)
        } catch {
          faixa.stop()
          if (faixa.source === Track.Source.ScreenShare) telaFicouFora = true
        }
      }
    }

    // O SDK desistiu. A pessoa não pediu para sair, então a sala volta sozinha — a não ser que
    // voltar não faça sentido (ver `motivoParaDesistir`).
    function religar(tentativa: number) {
      religando = true
      const comTela = [...orfas.keys()].some((faixa) => faixa.source === Track.Source.ScreenShare)
      setQueda({ tentativa, comTela })
      const atraso = ESPERAS_DO_RELIGAR_MS[tentativa - 1] ?? ESPERAS_DO_RELIGAR_MS.at(-1)
      // No relógio do worker: a queda costuma acontecer justamente com a aba em segundo plano.
      espera = CriticalTimers.setTimeout(() => {
        nova
          .connect(urlSfu, token)
          .then(async () => {
            if (vivo) await republicarOrfas()
            religando = false
            if (vivo) setQueda(null)
          })
          .catch((falha: unknown) => {
            if (!vivo) return
            const desistir = motivoParaDesistir(falha)
            if (!desistir) {
              religar(tentativa + 1)
              return
            }
            religando = false
            pararOrfas()
            setQueda(null)
            setErro(desistir)
          })
      }, atraso)
    }

    nova.on(RoomEvent.Disconnected, (motivo?: DisconnectReason) => {
      for (const [faixa, opcoes] of saindoAgora) {
        if (faixa.mediaStreamTrack.readyState !== 'ended') orfas.set(faixa, opcoes)
      }
      saindoAgora = []
      if (!vivo || motivo === DisconnectReason.CLIENT_INITIATED) {
        pararOrfas()
        return
      }
      if (religando) return
      // Outra aba tomou a identidade: religar viraria cabo de guerra entre as duas.
      if (motivo === DisconnectReason.DUPLICATE_IDENTITY) {
        pararOrfas()
        setErro('Você entrou nesta sala em outra aba; esta ficou de fora.')
        return
      }
      religar(1)
    })

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
      // Caída, a sala não tem o que despublicar, e `disconnect()` não para o que a queda guardou.
      pararOrfas()
      if (espera !== undefined) CriticalTimers.clearTimeout(espera)
      nova.removeAllListeners()
      void nova.disconnect()
      setSala(null)
    }
  }, [credenciais])

  return {
    sala,
    conexao,
    erro,
    queda,
    versao,
    audioLiberado,
    liberarAudio: () => {
      void sala?.startAudio().then(() => setAudioLiberado(true))
    },
  }
}
