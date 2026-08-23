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

export const CAPTURA_DO_AUDIO_DA_TELA: AudioCaptureOptions = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  // O SDK decide estéreo lendo `channelCount` das settings da faixa; sem pedir, o Chrome escolhe.
  channelCount: 2,
  sampleRate: 48_000,
}

export const OPCOES_DO_AUDIO_DA_TELA: TrackPublishOptions = {
  source: Track.Source.ScreenShareAudio,
  audioPreset: AudioPresets.musicHighQualityStereo,
  dtx: false,
  red: true,
  // Cinto e suspensório: `channelCount` acima já deveria bastar, mas o Chrome às vezes relata
  // mono em captura de aba, e aí o SDK anunciaria mono ao SFU.
  forceStereo: true,
  stream: NOME_DO_FLUXO_DA_TELA,
}
