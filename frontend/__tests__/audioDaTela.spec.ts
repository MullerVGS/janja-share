import { AudioPresets, Track } from 'livekit-client'
import { describe, expect, it } from 'vitest'
import { CAPTURA_DO_AUDIO_DA_TELA, NOME_DO_FLUXO_DA_TELA, OPCOES_DO_AUDIO_DA_TELA } from '../src/sala/audioDaTela'

describe('áudio da tela: a captura não é voz', () => {
  it('desliga todo o processamento de voz do Chrome', () => {
    expect(CAPTURA_DO_AUDIO_DA_TELA.echoCancellation).toBe(false)
    expect(CAPTURA_DO_AUDIO_DA_TELA.noiseSuppression).toBe(false)
    expect(CAPTURA_DO_AUDIO_DA_TELA.autoGainControl).toBe(false)
  })

  it('pede estéreo em 48 kHz — é o que faz o SDK anunciar estéreo ao SFU', () => {
    expect(CAPTURA_DO_AUDIO_DA_TELA.channelCount).toBe(2)
    expect(CAPTURA_DO_AUDIO_DA_TELA.sampleRate).toBe(48_000)
  })
})

describe('áudio da tela: a publicação é de mídia', () => {
  it('vai a 128 kbps estéreo, não nos 48 kbps mono do SDK', () => {
    expect(OPCOES_DO_AUDIO_DA_TELA.audioPreset).toBe(AudioPresets.musicHighQualityStereo)
    expect(OPCOES_DO_AUDIO_DA_TELA.audioPreset?.maxBitrate).toBe(128_000)
    expect(OPCOES_DO_AUDIO_DA_TELA.forceStereo).toBe(true)
  })

  it('DTX desligado: em música ele corta cauda de reverb e passagem baixa', () => {
    expect(OPCOES_DO_AUDIO_DA_TELA.dtx).toBe(false)
  })

  it('mantém RED — dropout em música dói mais que os kbps da redundância', () => {
    expect(OPCOES_DO_AUDIO_DA_TELA.red).toBe(true)
  })

  it('divide o fluxo com o vídeo da tela, que é o que dá sincronia A/V', () => {
    expect(OPCOES_DO_AUDIO_DA_TELA.stream).toBe(NOME_DO_FLUXO_DA_TELA)
    expect(OPCOES_DO_AUDIO_DA_TELA.source).toBe(Track.Source.ScreenShareAudio)
  })
})
