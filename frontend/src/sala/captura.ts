import { LocalAudioTrack, LocalVideoTrack, Track, type LocalTrack } from 'livekit-client'
import { CAPTURA_DO_AUDIO_DA_TELA } from './audioDaTela'
import { alturaDaResolucao, CONTEUDOS, type PerfilDeQualidade } from './qualidade'

/**
 * A abertura do seletor nativo e o que sai dele.
 *
 * O SDK tem `createScreenTracks`, e por muito tempo ele bastou. O que o tirou do caminho foi
 * `windowAudio`: a tradução do SDK (`screenCaptureToDisplayMediaStreamOptions`) copia campo a
 * campo uma lista fixa, e o que não está nela é descartado em silêncio. Como a captura passou a
 * depender de um campo que o SDK não conhece, o `getDisplayMedia` vira nosso — e montar as
 * faixas é o resto do trabalho que o SDK fazia, reproduzido aqui.
 */

/** O que o `lib.dom` ainda não tipa do Screen Capture. */
export interface OpcoesDeCapturaDeTela extends DisplayMediaStreamOptions {
  /** Só vale para monitor: se o seletor oferece junto o áudio do sistema. */
  systemAudio?: 'include' | 'exclude'
  /** Só vale para janela: o áudio *daquela* janela, o do sistema inteiro, ou nenhum. */
  windowAudio?: 'system' | 'window' | 'exclude'
  surfaceSwitching?: 'include' | 'exclude'
  selfBrowserSurface?: 'include' | 'exclude'
}

/**
 * Opções da captura de tela.
 *
 * Não existe picker próprio: o seletor nativo do Chrome é o produto. O que este objeto faz é
 * pedir a ele os recursos que valem a pena — o áudio, e o botão nativo de trocar a tela
 * compartilhada sem derrubar a transmissão (`surfaceSwitching`).
 *
 * Os dois eixos de áudio são independentes porque as superfícies são: `systemAudio` só é lido
 * quando a pessoa escolhe um monitor, `windowAudio` só quando escolhe uma janela. Pedir
 * `'window'` é o que abre o caminho limpo do jogo nativo — o som sai do processo escolhido, sem
 * levar junto o Discord e o janja que dividem o mix do sistema.
 *
 * Em "Nativa" o tamanho simplesmente não é restringido: a tela vai como o monitor entrega, que
 * é o que a UI promete. A taxa de quadros vai nos dois casos.
 */
export function opcoesDeCaptura(perfil: PerfilDeQualidade): OpcoesDeCapturaDeTela {
  const altura = alturaDaResolucao(perfil.resolucao)
  return {
    audio: CAPTURA_DO_AUDIO_DA_TELA,
    video: {
      ...(altura === null
        ? {}
        : { width: { ideal: Math.round((altura * 16) / 9) }, height: { ideal: altura } }),
      frameRate: perfil.fps,
    },
    systemAudio: 'include',
    windowAudio: 'window',
    surfaceSwitching: 'include',
    // A própria aba do janja-share na lista só produz o túnel de espelhos.
    selfBrowserSurface: 'exclude',
  }
}

/**
 * Abre o seletor e devolve as faixas prontas para publicar — vídeo sempre, áudio quando a
 * pessoa marcou a caixa do seletor.
 *
 * `source` é o que faz a publicação chegar como tela e como som de tela; sem ele a faixa entra
 * como câmera e microfone e some do palco. `false` no terceiro argumento diz ao SDK que a faixa
 * é dele: é o que permite ao ciclo de vida da publicação pará-la.
 */
export async function capturarTela(perfil: PerfilDeQualidade): Promise<LocalTrack[]> {
  const fluxo = await navigator.mediaDevices.getDisplayMedia(opcoesDeCaptura(perfil))

  const [video] = fluxo.getVideoTracks()
  if (!video) {
    // Nunca deve acontecer — mas uma captura só de áudio deixaria o Chrome dizendo que a
    // pessoa está compartilhando a tela com ninguém do outro lado.
    fluxo.getTracks().forEach((faixa) => faixa.stop())
    throw new Error('o navegador devolveu uma captura sem vídeo')
  }

  const tela = new LocalVideoTrack(video, undefined, false)
  tela.source = Track.Source.ScreenShare
  // O hint sobrevive ao `applyConstraints` e diz ao encoder se o conteúdo é texto ou movimento.
  tela.mediaStreamTrack.contentHint = CONTEUDOS[perfil.conteudo].contentHint
  const faixas: LocalTrack[] = [tela]

  const [som] = fluxo.getAudioTracks()
  if (som) {
    const audio = new LocalAudioTrack(som, undefined, false)
    audio.source = Track.Source.ScreenShareAudio
    faixas.push(audio)
  }

  return faixas
}
