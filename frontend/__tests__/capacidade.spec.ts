import { afterEach, describe, expect, it, vi } from 'vitest'
import { codecDePartida, CODEC_PADRAO, escolherCorrecao } from '../src/sala/capacidade'
import { PERFIL_PADRAO } from '../src/sala/qualidade'

function comSuporte(mimes: string[]) {
  vi.stubGlobal('RTCRtpSender', { getCapabilities: () => ({ codecs: mimes.map((mimeType) => ({ mimeType })) }) })
}

/** `null` em `eficientes` = a API de capacidade não existe neste navegador. */
function comMediaCapabilities(eficientes: string[] | null, tipoAceito = 'webrtc') {
  if (eficientes === null) {
    vi.stubGlobal('navigator', {})
    return
  }
  vi.stubGlobal('navigator', {
    mediaCapabilities: {
      encodingInfo: async (config: { type: string; video: { contentType: string } }) => {
        if (config.type !== tipoAceito) throw new TypeError('type não suportado')
        const eficiente = eficientes.includes(config.video.contentType)
        return { supported: true, smooth: eficiente, powerEfficient: eficiente }
      },
    },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('codecDePartida', () => {
  it('a escolha da pessoa vence tudo, e nem consulta o navegador', async () => {
    comSuporte([])
    comMediaCapabilities(null)
    expect(await codecDePartida({ preferido: 'av1', aprendido: 'vp8', perfil: PERFIL_PADRAO })).toBe('av1')
  })

  it('o aprendido nesta máquina vence o palpite', async () => {
    comSuporte(['video/VP9', 'video/H264', 'video/VP8'])
    comMediaCapabilities(['video/VP9'])
    expect(await codecDePartida({ preferido: 'auto', aprendido: 'h264', perfil: PERFIL_PADRAO })).toBe('h264')
  })

  it('o aprendido é ignorado quando o navegador não suporta mais', async () => {
    comSuporte(['video/VP9', 'video/VP8'])
    comMediaCapabilities(['video/VP9'])
    expect(await codecDePartida({ preferido: 'auto', aprendido: 'h264', perfil: PERFIL_PADRAO })).toBe('vp9')
  })

  it('cai para o nome não-padrão do Firefox quando "webrtc" é recusado', async () => {
    comSuporte(['video/VP9', 'video/H264'])
    comMediaCapabilities(['video/H264'], 'transmission')
    expect(await codecDePartida({ preferido: 'auto', aprendido: null, perfil: PERFIL_PADRAO })).toBe('h264')
  })

  it('sem mediaCapabilities, fica no padrão', async () => {
    comSuporte(['video/VP9', 'video/H264', 'video/VP8'])
    comMediaCapabilities(null)
    expect(await codecDePartida({ preferido: 'auto', aprendido: null, perfil: PERFIL_PADRAO })).toBe(CODEC_PADRAO)
  })

  it('sem suporte a nada, ainda devolve o padrão em vez de estourar', async () => {
    vi.stubGlobal('RTCRtpSender', {})
    comMediaCapabilities(null)
    expect(await codecDePartida({ preferido: 'auto', aprendido: null, perfil: PERFIL_PADRAO })).toBe(CODEC_PADRAO)
  })
})

describe('escolherCorrecao', () => {
  it('nunca devolve o codec que acabou de falhar', async () => {
    comSuporte(['video/VP9', 'video/H264', 'video/VP8'])
    comMediaCapabilities(['video/VP9'])
    expect(await escolherCorrecao('vp9', PERFIL_PADRAO)).not.toBe('vp9')
  })

  it('corrige de vp9 para h264 — a correção não tem lado', async () => {
    comSuporte(['video/VP9', 'video/H264', 'video/VP8'])
    comMediaCapabilities(['video/H264'])
    expect(await escolherCorrecao('vp9', PERFIL_PADRAO)).toBe('h264')
  })

  it('nunca escolhe AV1 sozinho, mesmo com o navegador aprovando', async () => {
    comSuporte(['video/AV1', 'video/H264'])
    comMediaCapabilities(['video/AV1'])
    expect(await escolherCorrecao('h264', PERFIL_PADRAO)).not.toBe('av1')
  })

  it('devolve null quando não sobrou candidato', async () => {
    comSuporte(['video/VP9'])
    comMediaCapabilities(['video/VP9'])
    expect(await escolherCorrecao('vp9', PERFIL_PADRAO)).toBeNull()
  })
})
