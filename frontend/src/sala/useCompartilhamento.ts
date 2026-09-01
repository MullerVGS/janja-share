import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Track,
  type LocalTrack,
  type LocalTrackPublication,
  type LocalVideoTrack,
  type Room,
  type TrackPublishOptions,
} from 'livekit-client'
import { gravarPreferencias, lerPreferencias } from '../preferencias'
import type { AmostraDoEmissor } from '../telemetria/amostra'
import type { Historico } from '../telemetria/historico'
import type { Espectador } from '../telemetria/relato'
import { NOME_DO_FLUXO_DA_TELA, OPCOES_DO_AUDIO_DA_TELA } from './audioDaTela'
import { codecDePartida, escolherCorrecao } from './capacidade'
import { capturarTela } from './captura'
import {
  decidir,
  GOVERNADOR_PARADO,
  perfilEfetivo as combinar,
  zerarGovernador,
  type EstadoDoGovernador,
} from './governador'
import {
  aplicarPerfil,
  CEDER,
  CODECS,
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
 * Simulcast fora, SVC dentro.
 *
 * Simulcast manda codificações independentes e o uplink vira a soma delas — caro exatamente no
 * lugar que dói, que é o upload de quem compartilha. `L3T3_KEY` põe três camadas espaciais e
 * três temporais num fluxo só, ~20% mais caro que camada única, e o SFU escolhe por
 * espectador: é o que impede o amigo mais lento de puxar a sala inteira para baixo agora que o
 * governador escuta quem assiste.
 *
 * A camada única de antes se justificava por um medidor manual exato: o teto do painel era uma
 * promessa e o número tinha de corresponder a ela. O medidor manual acabou — o teto virou uma
 * busca do governador, e não há mais promessa exata a proteger.
 *
 * O encoding vai em `screenShareEncoding`, não em `videoEncoding`: o `computeVideoEncodings` do
 * SDK só olha para o primeiro quando a fonte é tela. Com o campo errado, a transmissão nascia
 * no default do SDK (h1080fps15) e só era corrigida pelo `setParameters` — ou seja, escolher
 * Movimento e começar a compartilhar dava 15 fps nos primeiros instantes.
 *
 * `backupCodec: false`: o reserva em VP8 existe para navegadores que não decodificam VP9/AV1,
 * e aqui todo mundo é Chrome desktop — seria uplink dobrado para ninguém. H.264 não faz SVC:
 * lá a camada continua única, e é por isso que o governador mira o pior espectador.
 */
export function opcoesDePublicacao(perfil: PerfilDeQualidade): TrackPublishOptions {
  return {
    source: Track.Source.ScreenShare,
    simulcast: false,
    videoCodec: perfil.codec,
    backupCodec: false,
    ...(CODECS[perfil.codec].svc ? { scalabilityMode: 'L3T3_KEY' as const } : {}),
    degradationPreference: CEDER[perfil.ceder].degradacao,
    screenShareEncoding: { maxBitrate: perfil.tetoKbps * 1000, maxFramerate: perfil.fps },
    stream: NOME_DO_FLUXO_DA_TELA,
  }
}

export interface Compartilhamento {
  ativo: boolean
  /** O pedido da pessoa: o preset de onde o governador parte. */
  perfil: PerfilDeQualidade
  definirPerfil(perfil: PerfilDeQualidade): void
  /** Pedido ⊕ teto ⊕ degrau do governador — o que de fato está na captura e no encoder. */
  perfilEfetivo: PerfilDeQualidade
  automatico: boolean
  definirAutomatico(ligado: boolean): void
  /** A intenção da pessoa sobre o codec; `'auto'` deixa a máquina resolver e corrigir. */
  codecPreferido: 'auto' | Codec
  definirCodecPreferido(codec: 'auto' | Codec): void
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

/** Uma referência estável: uma sala sem espectador nenhum não pode remontar o efeito a cada render. */
const SEM_ESPECTADORES: ReadonlyMap<string, Espectador> = new Map()

/**
 * O compartilhamento de tela: o pedido da pessoa, o governador por cima dele, e a tradução dos
 * dois para o SDK. O `historico` é a telemetria do emissor e `espectadores` a de quem assiste;
 * é das duas que o governador decide.
 */
export function useCompartilhamento(
  sala: Room | null,
  historico: Historico<AmostraDoEmissor>,
  espectadores: ReadonlyMap<string, Espectador> = SEM_ESPECTADORES,
): Compartilhamento {
  const publicacao = sala ? publicacaoDe(sala, Track.Source.ScreenShare) : undefined
  const sid = publicacao?.trackSid ?? null

  const [guardadas] = useState(lerPreferencias)
  const [perfil, setPerfil] = useState(guardadas.perfil)
  const [automatico, setAutomatico] = useState(guardadas.automatico)
  const [codecPreferido, setCodecPreferido] = useState(guardadas.codecPreferido)
  const [governador, setGovernador] = useState(GOVERNADOR_PARADO)
  const [relatorio, setRelatorio] = useState<RelatorioDeAplicacao | null>(null)
  const [codecPendente, setCodecPendente] = useState<Codec | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mudando, setMudando] = useState(false)
  const [republicando, setRepublicando] = useState(false)
  const [trocandoTela, setTrocandoTela] = useState(false)
  // O último pedido, para a republicação em curso saber se ficou para trás.
  const pedido = useRef(perfil)
  // O candidato da correção, sondado enquanto há tela no ar: `decidir` é função pura e não pode
  // esperar por uma Promise.
  const candidatoDeCodec = useRef<Codec | null>(null)

  // Republicar e trocar de tela deixam a tela sem publicação por um instante; isso não é "parou".
  //
  // O teto que o governador aprendeu é propriedade do **link**, não do conteúdo: trocar a tela
  // compartilhada não muda a banda de quem transmite. Deixar `ativo` cair na janela entre o
  // unpublish e o publish faria o efeito do governador zerá-lo — numa live que subiu de 4 para
  // 12 Mb/s, trocar de tela recomeçaria a busca do zero. E os dois outros leitores de `ativo`
  // pagam junto: os botões da barra desmontam e remontam, e a gaveta de Qualidade se reabre por
  // cima do palco de quem a tinha fechado.
  const ativo = Boolean(publicacao) || republicando || trocandoTela

  // Os relatos chegam no ritmo de quem assiste — a cada 2 s, e um por pessoa. O governador não
  // anda com eles: ele anda uma vez por amostra do emissor, e lê o último relato de cada um.
  const ultimosRelatos = useRef(espectadores)
  ultimosRelatos.current = espectadores

  // O governador anda uma vez por amostra nova; parar de transmitir o zera.
  useEffect(() => {
    if (!ativo) {
      setGovernador(GOVERNADOR_PARADO)
      return
    }
    if (!automatico) return
    setGovernador((estado) =>
      decidir(estado, historico, perfil, [...ultimosRelatos.current.values()], candidatoDeCodec.current),
    )
  }, [historico, automatico, ativo, perfil])

  // Só o degrau e o teto mudam o efetivo; o resto do estado muda a cada amostra limitada.
  const perfilEfetivo = useMemo(() => combinar(perfil, governador), [perfil, governador.degrau, governador.tetoKbps])

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

  // `contentHint` é o equivalente sonoro do 'text'/'motion' do vídeo: diz ao encoder que o
  // conteúdo é música, não fala. Vale na faixa e sobrevive à republicação, então basta marcar
  // sempre que a publicação de áudio for outra.
  const sidDoAudio = (sala ? publicacaoDe(sala, Track.Source.ScreenShareAudio) : undefined)?.trackSid ?? null
  useEffect(() => {
    if (!sala) return
    const faixa = publicacaoDe(sala, Track.Source.ScreenShareAudio)?.track?.mediaStreamTrack
    if (faixa) faixa.contentHint = 'music'
  }, [sala, sidDoAudio])

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

  /**
   * O candidato da correção, refeito a cada codec que entra no ar — o próximo nunca é o que
   * está tocando agora. Fica num ref porque `decidir` é síncrona e pura: ela não pode esperar
   * pela sondagem, só consultar o que já foi sondado.
   */
  const codecNoAr = publicacao ? perfilEfetivo.codec : null
  useEffect(() => {
    if (!codecNoAr) {
      candidatoDeCodec.current = null
      return
    }
    let vivo = true
    void escolherCorrecao(codecNoAr, pedido.current).then((candidato) => {
      if (vivo) candidatoDeCodec.current = candidato
    })
    return () => {
      vivo = false
    }
    // Só o codec no ar refaz a sondagem: mexer no teto ou no fps não muda quem é o candidato.
  }, [codecNoAr])

  /**
   * O que o governador resolveu vira republicação — e vira aprendizado, para a próxima
   * transmissão desta máquina já nascer no codec certo.
   *
   * `perfil` de propósito **não** muda aqui: ele é o pedido, e o pedido continua sendo o codec
   * da partida. Quem carrega a correção é `perfilEfetivo`, como já carrega o teto e o degrau —
   * e é dessa diferença que a UI tira o codec anterior para oferecer o Desfazer.
   *
   * `pedido.current` acompanha porque `republicar` o usa para detectar troca concorrente: sem
   * isso ele veria divergência ao terminar e republicaria de volta para o codec reprovado.
   */
  const codecResolvido = governador.codec
  useEffect(() => {
    if (!codecResolvido || !sala || republicando) return
    if (!publicacaoDe(sala, Track.Source.ScreenShare)) return
    if (pedido.current.codec === codecResolvido) return
    pedido.current = { ...pedido.current, codec: codecResolvido }
    gravarPreferencias({ codecAprendido: codecResolvido })
    void republicar({ ...perfilEfetivo, codec: codecResolvido })
  }, [codecResolvido, sala, republicando, republicar, perfilEfetivo])

  /**
   * O pedido da pessoa, menos o codec: quem manda nele é `definirCodecPreferido`.
   *
   * Codec tinha duas portas enquanto o preset o carregava, e as duas passaram a discordar: uma
   * gravava a intenção e a outra não, então reiniciar a transmissão devolvia o automático por
   * cima de uma escolha explícita. Uma decisão, um dono.
   */
  const definirPerfil = useCallback(
    (novo: PerfilDeQualidade) => {
      const comCodecDeAgora = { ...novo, codec: pedido.current.codec }
      pedido.current = comCodecDeAgora
      setPerfil(comCodecDeAgora)
      gravarPreferencias({ perfil: comCodecDeAgora })
      setGovernador((estado) => zerarGovernador(historico, estado))
    },
    [historico],
  )

  const definirAutomatico = useCallback(
    (ligado: boolean) => {
      setAutomatico(ligado)
      gravarPreferencias({ automatico: ligado })
      setGovernador((estado) => zerarGovernador(historico, estado))
    },
    [historico],
  )

  /**
   * A pessoa assumindo o codec. Forçar apaga a escolha do automático — sem isso `perfilEfetivo`
   * continuaria sobrepondo o que a máquina decidiu por cima do que a pessoa pediu, e o Desfazer
   * não desfaria nada.
   */
  const definirCodecPreferido = useCallback(
    (codec: 'auto' | Codec) => {
      setCodecPreferido(codec)
      gravarPreferencias({ codecPreferido: codec })
      setGovernador((estado) => (estado.codec === null ? estado : { ...estado, codec: null }))
      if (codec === 'auto' || codec === pedido.current.codec) return
      setCodecPendente(null)
      const novo = { ...pedido.current, codec }
      pedido.current = novo
      setPerfil(novo)
      if (!republicando) void republicar(novo)
    },
    [republicando, republicar],
  )

  /**
   * O perfil com que a transmissão nasce: o codec resolvido pela máquina, e não o que veio
   * guardado do preset. `setPerfil` direto e sem `gravarPreferencias` porque isto não é a
   * intenção da pessoa — a intenção dela é `codecPreferido`, e ela continua valendo.
   */
  const perfilDePartida = useCallback(async (): Promise<PerfilDeQualidade> => {
    const codec = await codecDePartida({
      preferido: codecPreferido,
      aprendido: lerPreferencias().codecAprendido,
      perfil,
    })
    const novo = { ...perfil, codec }
    pedido.current = novo
    setPerfil(novo)
    return novo
  }, [codecPreferido, perfil])

  /**
   * `setScreenShareEnabled(true, captura, opções)` publica TODA faixa que a captura devolve com
   * o mesmo `opções` — moldado para vídeo (`screenShareEncoding`, `videoCodec`...). É por isso
   * que o áudio da tela nascia em 48 kbps mono com DTX mesmo com `OPCOES_DO_AUDIO_DA_TELA`
   * existindo: o caminho comum de começar a compartilhar nunca chegava a usá-las. A saída é a
   * mesma de `trocarDeTela` — capturar e publicar cada faixa com a opção dela, em vez de delegar
   * as duas ao SDK de uma vez.
   */
  const ligar = useCallback(
    async (desligarAntes: boolean) => {
      if (!sala) return
      const participante = sala.localParticipant
      setErro(null)
      setMudando(true)
      let capturadas: LocalTrack[] = []
      try {
        if (desligarAntes) await participante.setScreenShareEnabled(false)
        setCodecPendente(null)
        // Começa pelo pedido: parar zerou o governador, e um degrau antigo não tem mais motivo.
        capturadas = await capturarTela(perfil)
        const video = capturadas.find((faixa) => faixa.kind === Track.Kind.Video)
        if (video) {
          await participante.publishTrack(video, opcoesDePublicacao(await perfilDePartida()))
          const audio = capturadas.find((faixa) => faixa.kind === Track.Kind.Audio)
          if (audio) await participante.publishTrack(audio, OPCOES_DO_AUDIO_DA_TELA)
        }
      } catch (falha) {
        // Cancelar o seletor nativo do Chrome cai aqui como `NotAllowedError`; não é erro para
        // mostrar em vermelho, é a pessoa mudando de ideia.
        const nome = falha instanceof Error ? falha.name : ''
        if (nome !== 'NotAllowedError' && nome !== 'AbortError') {
          setErro(falha instanceof Error ? falha.message : 'não foi possível compartilhar a tela')
        }
      } finally {
        pararOQueNaoFoiAoAr(sala, capturadas)
        setMudando(false)
      }
    },
    [sala, perfil, perfilDePartida],
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
      capturadas = await capturarTela(perfil)
      // Seletor sem vídeo não é troca de tela; a de agora continua valendo mais que nada.
      const video = capturadas.find((faixa) => faixa.kind === Track.Kind.Video)
      if (video) {
        // Da despublicação até aqui embaixo a própria tela some e volta da lista de telas
        // publicadas — `trocandoTela` avisa quem monta o palco pra ignorar esse blip.
        setTrocandoTela(true)
        await participante.setScreenShareEnabled(false)
        setCodecPendente(null)
        await participante.publishTrack(video, opcoesDePublicacao(await perfilDePartida()))
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
  }, [sala, perfil, perfilDePartida])

  /** Publica faixas capturadas fora daqui — a captura que a home abriu antes de navegar. */
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
    codecPreferido,
    definirCodecPreferido,
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
