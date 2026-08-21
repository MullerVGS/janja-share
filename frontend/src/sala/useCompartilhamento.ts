import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Track,
  type LocalTrack,
  type LocalTrackPublication,
  type LocalVideoTrack,
  type Room,
  type TrackPublishOptions,
} from 'livekit-client'
import type { ScreenShareCaptureOptions } from 'livekit-client'
import { gravarPreferencias, lerPreferencias } from '../preferencias'
import type { AmostraDoEmissor } from '../telemetria/amostra'
import type { Historico } from '../telemetria/historico'
import {
  decidir,
  GOVERNADOR_PARADO,
  perfilEfetivo as combinar,
  zerarGovernador,
  type EstadoDoGovernador,
} from './governador'
import {
  aplicarPerfil,
  alturaDaResolucao,
  CEDER,
  CODECS,
  CONTEUDOS,
  type Codec,
  type PerfilDeQualidade,
  type RelatorioDeAplicacao,
} from './qualidade'

/**
 * Espera antes de aplicar um perfil novo. É o que permite arrastar o slider de bitrate sem
 * disparar um `setParameters` por pixel percorrido.
 */
const ATRASO_DO_AJUSTE_MS = 180

/**
 * Opções da captura de tela.
 *
 * Não existe picker próprio: o seletor nativo do Chrome é o produto. O que este objeto faz é
 * pedir a ele os recursos que valem a pena — áudio da aba, e o botão nativo de trocar a tela
 * compartilhada sem derrubar a transmissão (`surfaceSwitching`).
 *
 * `resolution` é obrigatório mesmo em "Nativa": omitir faz o SDK injetar
 * `ScreenSharePresets.h1080fps30.resolution`, e a captura nasceria travada em 1080p enquanto a
 * UI promete que a tela vai como o monitor entrega. Zero é o "sem teto" do SDK — e é o preço de
 * o `frameRate` daqui também ser ignorado nesse modo (a cláusula do SDK exige largura e altura
 * positivas), o que o `applyConstraints` logo em seguida resolve.
 */
export function opcoesDeCaptura(perfil: PerfilDeQualidade): ScreenShareCaptureOptions {
  const altura = alturaDaResolucao(perfil.resolucao)
  return {
    audio: true,
    systemAudio: 'include',
    surfaceSwitching: 'include',
    // A própria aba do share na lista só produz o túnel de espelhos.
    selfBrowserSurface: 'exclude',
    contentHint: CONTEUDOS[perfil.conteudo].contentHint,
    resolution:
      altura === null
        ? { width: 0, height: 0 }
        : { width: Math.round((altura * 16) / 9), height: altura, frameRate: perfil.fps },
  }
}

/**
 * Camada única de propósito: o teto de bitrate do painel vira uma promessa exata e o medidor
 * mostra um número que corresponde a ela. Com simulcast o uplink seria a soma das camadas —
 * e numa sala de cinco pessoas ninguém assina a versão pequena de uma tela em destaque.
 *
 * O encoding vai em `screenShareEncoding`, não em `videoEncoding`: o `computeVideoEncodings` do
 * SDK só olha para o primeiro quando a fonte é tela. Com o campo errado, a transmissão nascia
 * no default do SDK (h1080fps15) e só era corrigida pelo `setParameters` — ou seja, escolher
 * Movimento e começar a compartilhar dava 15 fps nos primeiros instantes.
 *
 * `backupCodec: false`: o reserva em VP8 existe para navegadores que não decodificam VP9/AV1,
 * e aqui todo mundo é Chrome desktop — seria uplink dobrado para ninguém. `L1T2` nos codecs
 * SVC dá ao SFU duas camadas temporais: quem assiste devagar recebe metade dos quadros sem
 * que o emissor precise saber.
 */
export function opcoesDePublicacao(perfil: PerfilDeQualidade): TrackPublishOptions {
  return {
    source: Track.Source.ScreenShare,
    simulcast: false,
    videoCodec: perfil.codec,
    backupCodec: false,
    ...(CODECS[perfil.codec].svc ? { scalabilityMode: 'L1T2' as const } : {}),
    degradationPreference: CEDER[perfil.ceder].degradacao,
    screenShareEncoding: { maxBitrate: perfil.tetoKbps * 1000, maxFramerate: perfil.fps },
  }
}

const OPCOES_DO_AUDIO_DA_TELA: TrackPublishOptions = { source: Track.Source.ScreenShareAudio }

export interface Compartilhamento {
  ativo: boolean
  /** O pedido da pessoa: o teto do governador. */
  perfil: PerfilDeQualidade
  definirPerfil(perfil: PerfilDeQualidade): void
  /** Pedido ⊕ degrau do governador — o que de fato está na captura e no encoder. */
  perfilEfetivo: PerfilDeQualidade
  automatico: boolean
  definirAutomatico(ligado: boolean): void
  governador: EstadoDoGovernador
  /** O que de fato pegou no último ajuste; `null` enquanto não há transmissão. */
  relatorio: RelatorioDeAplicacao | null
  /** Codec pedido que o SDK não pôs no ar: vale no próximo compartilhamento. */
  codecPendente: Codec | null
  /** A publicação do som da tela; `null` quando o seletor nativo não marcou "compartilhar áudio". */
  audioDaTela: LocalTrackPublication | null
  /** Cala e devolve o som da tela para a sala, sem republicar nada. */
  alternarAudioDaTela(): Promise<void>
  erro: string | null
  ocupado: boolean
  alternar(): Promise<void>
  /** Para e começa de novo — reabre o seletor nativo. É a saída quando republicar não deu. */
  reiniciar(): Promise<void>
  /** Reabre o seletor para escolher outra tela; cancelar deixa a de agora no ar. */
  trocarDeTela(): Promise<void>
  /**
   * True só durante o vaivém interno de unpublish+republish de `trocarDeTela` — a própria tela
   * some e volta da lista de telas publicadas nesse meio-tempo. Existe para quem monta o palco
   * (Sala.tsx) ignorar essa sumida/volta transitória: sem isso ela dispara duas vezes a
   * heurística de "tela própria nova" de foco.ts — expulsa quem está vendo outra coisa quando a
   * tela some, e rouba o foco de volta quando ela reaparece.
   */
  trocandoTela: boolean
}

function publicacaoDe(sala: Room, fonte: Track.Source): LocalTrackPublication | undefined {
  return sala.localParticipant.getTrackPublication(fonte) as LocalTrackPublication | undefined
}

function faixaMorta(faixa: LocalTrack): boolean {
  return faixa.mediaStreamTrack.readyState === 'ended'
}

/**
 * Captura aberta que não foi ao ar tem de morrer. Uma faixa viva e despublicada deixa o
 * navegador dizendo que você está compartilhando a tela — com ninguém do outro lado recebendo.
 */
function pararOQueNaoFoiAoAr(sala: Room, capturadas: LocalTrack[]): void {
  const noAr = [
    publicacaoDe(sala, Track.Source.ScreenShare)?.track,
    publicacaoDe(sala, Track.Source.ScreenShareAudio)?.track,
  ]
  for (const faixa of capturadas) if (!noAr.includes(faixa)) faixa.stop()
}

/**
 * O compartilhamento de tela: o pedido da pessoa, o governador por cima dele, e a tradução dos
 * dois para o SDK. O `historico` é a telemetria do emissor; é dele que o governador decide.
 */
export function useCompartilhamento(sala: Room | null, historico: Historico<AmostraDoEmissor>): Compartilhamento {
  const publicacao = sala ? publicacaoDe(sala, Track.Source.ScreenShare) : undefined
  const sid = publicacao?.trackSid ?? null

  const [guardadas] = useState(lerPreferencias)
  const [perfil, setPerfil] = useState(guardadas.perfil)
  const [automatico, setAutomatico] = useState(guardadas.automatico)
  const [governador, setGovernador] = useState(GOVERNADOR_PARADO)
  const [relatorio, setRelatorio] = useState<RelatorioDeAplicacao | null>(null)
  const [codecPendente, setCodecPendente] = useState<Codec | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mudando, setMudando] = useState(false)
  const [republicando, setRepublicando] = useState(false)
  const [trocandoTela, setTrocandoTela] = useState(false)
  // O último pedido, para a republicação em curso saber se ficou para trás.
  const pedido = useRef(perfil)

  // Republicar deixa a tela sem publicação por um instante; isso não é "parou".
  const ativo = Boolean(publicacao) || republicando

  // O governador anda uma vez por amostra nova; parar de transmitir o zera.
  useEffect(() => {
    if (!ativo) {
      setGovernador(GOVERNADOR_PARADO)
      return
    }
    if (!automatico) return
    setGovernador((estado) => decidir(estado, historico, perfil))
  }, [historico, automatico, ativo, perfil])

  // Só o degrau muda o efetivo; o resto do estado do governador muda a cada amostra limitada.
  const perfilEfetivo = useMemo(() => combinar(perfil, governador), [perfil, governador.degrau])

  // Ajuste ao vivo: sem republicar, sem renegociar. Roda também logo depois de publicar,
  // porque a captura entrega o que o monitor tem e o teto real é este.
  useEffect(() => {
    const faixa = publicacao?.track
    if (!faixa) {
      setRelatorio(null)
      return
    }
    const espera = setTimeout(() => {
      void aplicarPerfil({ faixa: faixa.mediaStreamTrack, remetente: faixa.sender }, perfilEfetivo).then(setRelatorio)
    }, ATRASO_DO_AJUSTE_MS)
    return () => clearTimeout(espera)
    // `sid` identifica a publicação; `publicacao.track` é lido na hora para pegar o sender que
    // costuma aparecer alguns milissegundos depois dela.
  }, [sid, perfilEfetivo, publicacao])

  /**
   * Troca de codec no ar: a mesma faixa de captura sai e volta com as opções novas — sem
   * reabrir o seletor, com um piscar de ~1 s para quem assiste. O áudio da tela vai junto para
   * as duas publicações seguirem do mesmo dono e com o mesmo ciclo de vida.
   *
   * Se o SDK recusar o vídeo, a anterior volta ao ar e o codec fica pendente; se a faixa chegar
   * morta ao despublicar, não há o que republicar e a transmissão cai — o botão Reiniciar
   * recomeça. Se só o áudio não voltar, o vídeo já está no ar com o codec novo: é erro à parte.
   */
  const republicar = useCallback(
    async (novo: PerfilDeQualidade) => {
      if (!sala) return
      const participante = sala.localParticipant
      const video = publicacaoDe(sala, Track.Source.ScreenShare)
      const faixa = video?.track as LocalVideoTrack | undefined
      if (!video || !faixa) return
      const audio = publicacaoDe(sala, Track.Source.ScreenShareAudio)?.track

      // Uma faixa despublicada sem parar e sem voltar ao ar fica órfã: a captura segue viva,
      // o Chrome segue "compartilhando", e ninguém recebe. Morrer é o único destino honesto.
      const pararAudioOrfao = () => {
        if (audio && !publicacaoDe(sala, Track.Source.ScreenShareAudio)) audio.stop()
      }

      setRepublicando(true)
      setErro(null)
      try {
        try {
          await participante.unpublishTrack(faixa, false)
          if (audio) await participante.unpublishTrack(audio, false)
          if (faixaMorta(faixa)) throw new Error('a captura morreu ao despublicar')
          await participante.publishTrack(faixa, opcoesDePublicacao(novo))
        } catch {
          setCodecPendente(novo.codec)
          if (!faixaMorta(faixa) && !publicacaoDe(sala, Track.Source.ScreenShare)) {
            try {
              await participante.publishTrack(faixa, video.options ?? opcoesDePublicacao(perfil))
            } catch {
              faixa.stop()
            }
          }
        }

        if (audio && !faixaMorta(audio) && publicacaoDe(sala, Track.Source.ScreenShare)) {
          try {
            await participante.publishTrack(audio, OPCOES_DO_AUDIO_DA_TELA)
          } catch {
            setErro('A tela voltou ao ar, mas o áudio da tela não. Reinicie a transmissão para recuperá-lo.')
          }
        }
      } finally {
        pararAudioOrfao()
        setRepublicando(false)
      }

      // A pessoa trocou de novo enquanto esta republicação andava.
      if (pedido.current.codec !== novo.codec && publicacaoDe(sala, Track.Source.ScreenShare)) {
        await republicar(pedido.current)
      }
    },
    [sala, perfil],
  )

  const definirPerfil = useCallback(
    (novo: PerfilDeQualidade) => {
      pedido.current = novo
      setPerfil(novo)
      gravarPreferencias({ perfil: novo })
      setGovernador(zerarGovernador(historico))
      if (novo.codec !== perfil.codec) {
        setCodecPendente(null)
        if (!republicando) void republicar(novo)
      }
    },
    [historico, perfil.codec, republicando, republicar],
  )

  const definirAutomatico = useCallback(
    (ligado: boolean) => {
      setAutomatico(ligado)
      gravarPreferencias({ automatico: ligado })
      setGovernador(zerarGovernador(historico))
    },
    [historico],
  )

  const ligar = useCallback(
    async (desligarAntes: boolean) => {
      if (!sala) return
      setErro(null)
      setMudando(true)
      try {
        if (desligarAntes) await sala.localParticipant.setScreenShareEnabled(false)
        setCodecPendente(null)
        // Começa pelo pedido: parar zerou o governador, e um degrau antigo não tem mais motivo.
        await sala.localParticipant.setScreenShareEnabled(true, opcoesDeCaptura(perfil), opcoesDePublicacao(perfil))
      } catch (falha) {
        // Cancelar o seletor nativo do Chrome cai aqui como `NotAllowedError`; não é erro para
        // mostrar em vermelho, é a pessoa mudando de ideia.
        const nome = falha instanceof Error ? falha.name : ''
        if (nome !== 'NotAllowedError' && nome !== 'AbortError') {
          setErro(falha instanceof Error ? falha.message : 'não foi possível compartilhar a tela')
        }
      } finally {
        setMudando(false)
      }
    },
    [sala, perfil],
  )

  const alternar = useCallback(async () => {
    if (!sala) return
    if (!publicacao) return ligar(false)
    setErro(null)
    setMudando(true)
    try {
      await sala.localParticipant.setScreenShareEnabled(false)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'não foi possível parar de compartilhar a tela')
    } finally {
      setMudando(false)
    }
  }, [sala, publicacao, ligar])

  const reiniciar = useCallback(() => ligar(Boolean(publicacao)), [ligar, publicacao])

  /**
   * Trocar a tela compartilhada sem sair do ar.
   *
   * A ordem é a regra: o seletor nativo abre **antes** de qualquer despublicação, e a captura
   * antiga só cai quando a nova já existe na mão. É isso que faz "cancelar não mexe em nada" ser
   * verdade — `reiniciar` não serve aqui porque ele para primeiro e pergunta depois.
   */
  const trocarDeTela = useCallback(async () => {
    if (!sala || !publicacaoDe(sala, Track.Source.ScreenShare)) return
    const participante = sala.localParticipant
    setErro(null)
    setMudando(true)
    let capturadas: LocalTrack[] = []
    try {
      capturadas = await participante.createScreenTracks(opcoesDeCaptura(perfil))
      // Seletor sem vídeo não é troca de tela; a de agora continua valendo mais que nada.
      const video = capturadas.find((faixa) => faixa.kind === Track.Kind.Video)
      if (video) {
        // Da despublicação até aqui embaixo a própria tela some e volta da lista de telas
        // publicadas — `trocandoTela` avisa quem monta o palco pra ignorar esse blip.
        setTrocandoTela(true)
        await participante.setScreenShareEnabled(false)
        setCodecPendente(null)
        await participante.publishTrack(video, opcoesDePublicacao(perfil))
        const audio = capturadas.find((faixa) => faixa.kind === Track.Kind.Audio)
        if (audio) await participante.publishTrack(audio, OPCOES_DO_AUDIO_DA_TELA)
      }
    } catch (falha) {
      const nome = falha instanceof Error ? falha.name : ''
      if (nome !== 'NotAllowedError' && nome !== 'AbortError') {
        setErro(falha instanceof Error ? falha.message : 'não foi possível trocar de tela')
      }
    } finally {
      pararOQueNaoFoiAoAr(sala, capturadas)
      setMudando(false)
      setTrocandoTela(false)
    }
  }, [sala, perfil])

  /**
   * Calar o som da tela é `mute()` na publicação, não despublicar: a faixa continua no ar,
   * quem assiste vê o silêncio chegar na hora, e voltar a falar não custa uma renegociação.
   * Recapturar seria a única alternativa — e recapturar reabre o seletor nativo.
   */
  const alternarAudioDaTela = useCallback(async () => {
    const audio = sala ? publicacaoDe(sala, Track.Source.ScreenShareAudio) : undefined
    if (!audio) return
    setErro(null)
    try {
      await (audio.isMuted ? audio.unmute() : audio.mute())
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'não foi possível mudar o áudio da tela')
    }
  }, [sala])

  return {
    ativo,
    perfil,
    definirPerfil,
    perfilEfetivo,
    automatico,
    definirAutomatico,
    governador,
    relatorio,
    codecPendente,
    audioDaTela: (sala && publicacaoDe(sala, Track.Source.ScreenShareAudio)) ?? null,
    alternarAudioDaTela,
    erro,
    ocupado: mudando || republicando,
    alternar,
    reiniciar,
    trocarDeTela,
    trocandoTela,
  }
}
