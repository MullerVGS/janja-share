import { AudioPresets, Track, type AudioCaptureOptions, type TrackPublishOptions } from 'livekit-client'

/**
 * O áudio da tela nunca é voz — é trilha de filme, música, som de jogo.
 *
 * O default do SDK (`publishDefaults`) é feito para microfone: 48 kbps mono com DTX. Em voz
 * isso economiza banda de graça; numa trilha sonora o DTX decepa cauda de reverb e apaga
 * passagem baixa, e o mono joga fora metade da mixagem. E `audio: true` na captura entrega a
 * decisão ao Chrome, que aplica AGC — um compressor mexendo no volume de uma mixagem que
 * alguém equilibrou de propósito.
 */

/** O mesmo `stream` no vídeo e no áudio põe os dois no mesmo `MediaStream` de quem recebe — sincronia A/V. */
export const NOME_DO_FLUXO_DA_TELA = 'tela'

/**
 * `restrictOwnAudio` é do Screen Capture, não do SDK nem do `lib.dom` — mas o objeto de áudio
 * viaja cru até o `getDisplayMedia`, então basta declará-lo aqui.
 */
export type CapturaDoAudioDaTela = AudioCaptureOptions & { restrictOwnAudio?: boolean }

export const CAPTURA_DO_AUDIO_DA_TELA: CapturaDoAudioDaTela = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  /**
   * O antídoto da microfonia de tela inteira: o Chrome captura o mix do sistema e subtrai dele
   * o que **esta aba** está tocando — ou seja, as vozes da sala que o janja acabou de
   * reproduzir. Sem isso, tudo que quem transmite ouve volta para quem falou, e o laço fecha
   * com atraso maior que a janela do cancelador de eco, que por isso não pega.
   *
   * Só alcança esta aba. O que outro aplicativo toca (Discord) segue no mix e é
   * indistinguível do som que a pessoa quis compartilhar — aí nenhum navegador ajuda.
   */
  restrictOwnAudio: true,
  // Formato não se pede: o loopback entrega o do dispositivo de saída, e divergir derruba a
  // captura inteira. Quem garante o estéreo de quem recebe é `forceStereo` lá embaixo.
}

export const OPCOES_DO_AUDIO_DA_TELA: TrackPublishOptions = {
  source: Track.Source.ScreenShareAudio,
  audioPreset: AudioPresets.musicHighQualityStereo,
  dtx: false,
  red: true,
  // O único lugar onde o estéreo é decidido, agora que a captura não pede formato: o SDK lê
  // `channelCount` das settings da faixa para escolher, e o Chrome às vezes relata mono ali.
  // Sem isto, uma mixagem estéreo chegaria a todo mundo anunciada como mono.
  forceStereo: true,
  stream: NOME_DO_FLUXO_DA_TELA,
}
