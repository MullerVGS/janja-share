import { useCallback, useEffect, useState } from 'react'
import { Track, type LocalTrackPublication, type Room, type TrackPublishOptions } from 'livekit-client'
import type { ScreenShareCaptureOptions } from 'livekit-client'
import {
  aplicarPerfil,
  alturaDaResolucao,
  PERFIL_PADRAO,
  PRIORIDADES,
  type PerfilDeQualidade,
  type RelatorioDeAplicacao,
} from './qualidade'
import { medirSaida, MEDIDA_VAZIA, type AmostraDeSaida, type MedidaDeSaida } from './medidor'

/** De quanto em quanto tempo o medidor lê o `getStats()`. */
const INTERVALO_DO_MEDIDOR_MS = 1000

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
 */
function opcoesDeCaptura(perfil: PerfilDeQualidade): ScreenShareCaptureOptions {
  const altura = alturaDaResolucao(perfil.resolucao)
  return {
    audio: true,
    systemAudio: 'include',
    surfaceSwitching: 'include',
    // A própria aba do share na lista só produz o túnel de espelhos.
    selfBrowserSurface: 'exclude',
    contentHint: PRIORIDADES[perfil.prioridade].contentHint,
    ...(altura === null ? {} : { resolution: { width: Math.round((altura * 16) / 9), height: altura, frameRate: perfil.fps } }),
  }
}

/**
 * Camada única de propósito: o teto de bitrate do painel vira uma promessa exata e o medidor
 * mostra um número que corresponde a ela. Com simulcast o uplink seria a soma das camadas —
 * e numa sala de cinco pessoas ninguém assina a versão pequena de uma tela em destaque.
 */
function opcoesDePublicacao(perfil: PerfilDeQualidade): TrackPublishOptions {
  return {
    source: Track.Source.ScreenShare,
    simulcast: false,
    degradationPreference: PRIORIDADES[perfil.prioridade].degradacao,
    videoEncoding: { maxBitrate: perfil.tetoKbps * 1000, maxFramerate: perfil.fps },
  }
}

export interface Compartilhamento {
  ativo: boolean
  perfil: PerfilDeQualidade
  definirPerfil(perfil: PerfilDeQualidade): void
  medida: MedidaDeSaida
  /** O que de fato pegou no último ajuste; `null` enquanto não há transmissão. */
  relatorio: RelatorioDeAplicacao | null
  erro: string | null
  ocupado: boolean
  alternar(): Promise<void>
}

export function useCompartilhamento(sala: Room | null): Compartilhamento {
  const publicacao =
    (sala?.localParticipant.getTrackPublication(Track.Source.ScreenShare) as LocalTrackPublication | undefined) ?? null
  const sid = publicacao?.trackSid ?? null

  const [perfil, definirPerfil] = useState<PerfilDeQualidade>(PERFIL_PADRAO)
  const [relatorio, setRelatorio] = useState<RelatorioDeAplicacao | null>(null)
  const [medida, setMedida] = useState<MedidaDeSaida>(MEDIDA_VAZIA)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // Ajuste ao vivo: sem republicar, sem renegociar. Roda também logo depois de publicar,
  // porque a captura entrega o que o monitor tem e o teto real é este.
  useEffect(() => {
    const faixa = publicacao?.track
    if (!faixa) {
      setRelatorio(null)
      return
    }
    const espera = setTimeout(() => {
      void aplicarPerfil({ faixa: faixa.mediaStreamTrack, remetente: faixa.sender }, perfil).then(setRelatorio)
    }, ATRASO_DO_AJUSTE_MS)
    return () => clearTimeout(espera)
    // `sid` identifica a publicação; `publicacao.track` é lido na hora para pegar o sender que
    // costuma aparecer alguns milissegundos depois dela.
  }, [sid, perfil, publicacao])

  useEffect(() => {
    if (!sid) {
      setMedida(MEDIDA_VAZIA)
      return
    }
    let anterior: AmostraDeSaida | null = null
    let vivo = true

    const ler = async () => {
      const remetente = publicacao?.track?.sender
      if (!remetente) return
      const relatorioDeEstatisticas = await remetente.getStats()
      if (!vivo) return
      const { medida: nova, amostra } = medirSaida(relatorioDeEstatisticas, anterior)
      anterior = amostra
      setMedida(nova)
    }

    void ler()
    const relogio = setInterval(() => void ler(), INTERVALO_DO_MEDIDOR_MS)
    return () => {
      vivo = false
      clearInterval(relogio)
    }
  }, [sid, publicacao])

  const alternar = useCallback(async () => {
    if (!sala) return
    setErro(null)
    setOcupado(true)
    try {
      const querLigar = !publicacao
      await sala.localParticipant.setScreenShareEnabled(
        querLigar,
        querLigar ? opcoesDeCaptura(perfil) : undefined,
        querLigar ? opcoesDePublicacao(perfil) : undefined,
      )
    } catch (falha) {
      // Cancelar o seletor nativo do Chrome cai aqui como `NotAllowedError`; não é erro para
      // mostrar em vermelho, é a pessoa mudando de ideia.
      const nome = falha instanceof Error ? falha.name : ''
      if (nome !== 'NotAllowedError' && nome !== 'AbortError') {
        setErro(falha instanceof Error ? falha.message : 'não foi possível compartilhar a tela')
      }
    } finally {
      setOcupado(false)
    }
  }, [sala, publicacao, perfil])

  return { ativo: Boolean(publicacao), perfil, definirPerfil, medida, relatorio, erro, ocupado, alternar }
}
