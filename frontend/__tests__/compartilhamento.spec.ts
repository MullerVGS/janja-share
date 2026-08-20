import { Track } from 'livekit-client'
import { describe, expect, it } from 'vitest'
import { PERFIL_PADRAO, PRESET_DO_CONTEUDO, type PerfilDeQualidade } from '../src/sala/qualidade'
import { opcoesDeCaptura, opcoesDePublicacao } from '../src/sala/useCompartilhamento'

function perfil(parcial: Partial<PerfilDeQualidade> = {}): PerfilDeQualidade {
  return { ...PERFIL_PADRAO, ...parcial }
}

/**
 * Estas opções são o único momento em que o perfil chega ao SDK antes de a transmissão existir.
 * Errar um nome de campo aqui não quebra nada visivelmente — só faz o compartilhamento nascer no
 * default do SDK e ser corrigido milissegundos depois, que é exatamente o instante em que a
 * pessoa está olhando. Daí os testes serem sobre os nomes dos campos.
 */
describe('opções de publicação da tela', () => {
  it('o teto e os quadros vão em screenShareEncoding — é o campo que o SDK lê para tela', () => {
    const opcoes = opcoesDePublicacao(perfil({ tetoKbps: 4000, fps: 30 }))
    expect(opcoes.screenShareEncoding).toEqual({ maxBitrate: 4_000_000, maxFramerate: 30 })
  })

  it('não usa videoEncoding: o computeVideoEncodings ignora esse campo quando a fonte é tela', () => {
    expect(opcoesDePublicacao(perfil()).videoEncoding).toBeUndefined()
  })

  it('o preset de movimento chega inteiro na publicação, sem esperar o setParameters', () => {
    const opcoes = opcoesDePublicacao(PRESET_DO_CONTEUDO.movimento)
    expect(opcoes.screenShareEncoding).toEqual({ maxBitrate: 8_000_000, maxFramerate: 60 })
    expect(opcoes.degradationPreference).toBe('maintain-framerate')
    expect(opcoes.videoCodec).toBe('h264')
  })

  it('ceder quadros publica pedindo que a resolução fique de pé', () => {
    expect(opcoesDePublicacao(perfil({ ceder: 'quadros' })).degradationPreference).toBe('maintain-resolution')
  })

  it('publica como tela, em camada única e sem codec reserva', () => {
    const opcoes = opcoesDePublicacao(perfil())
    expect(opcoes.source).toBe(Track.Source.ScreenShare)
    expect(opcoes.simulcast).toBe(false)
    expect(opcoes.backupCodec).toBe(false)
  })

  it('o codec escolhido vai em videoCodec', () => {
    expect(opcoesDePublicacao(perfil({ codec: 'av1' })).videoCodec).toBe('av1')
    expect(opcoesDePublicacao(perfil({ codec: 'vp8' })).videoCodec).toBe('vp8')
  })

  it('VP9 e AV1 pedem L1T2; H.264 e VP8 não têm scalabilityMode', () => {
    expect(opcoesDePublicacao(perfil({ codec: 'vp9' })).scalabilityMode).toBe('L1T2')
    expect(opcoesDePublicacao(perfil({ codec: 'av1' })).scalabilityMode).toBe('L1T2')
    expect(opcoesDePublicacao(perfil({ codec: 'h264' }))).not.toHaveProperty('scalabilityMode')
    expect(opcoesDePublicacao(perfil({ codec: 'vp8' }))).not.toHaveProperty('scalabilityMode')
  })
})

describe('opções de captura da tela', () => {
  it('resolução nativa pede zero, que é o "sem teto" do SDK', () => {
    // Omitir `resolution` faria o SDK injetar o preset de 1080p, e a captura nasceria travada
    // enquanto a UI promete que a tela vai como o monitor entrega.
    expect(opcoesDeCaptura(perfil({ resolucao: 'nativa' })).resolution).toEqual({ width: 0, height: 0 })
  })

  it('resolução escolhida vira altura, largura 16:9 e taxa de quadros', () => {
    expect(opcoesDeCaptura(perfil({ resolucao: '720p', fps: 15 })).resolution).toEqual({
      width: 1280,
      height: 720,
      frameRate: 15,
    })
  })

  it('pede áudio, o botão nativo de trocar de tela, e deixa a própria aba fora da lista', () => {
    const opcoes = opcoesDeCaptura(perfil())
    expect(opcoes.audio).toBe(true)
    expect(opcoes.surfaceSwitching).toBe('include')
    expect(opcoes.systemAudio).toBe('include')
    expect(opcoes.selfBrowserSurface).toBe('exclude')
  })

  it('a dica de conteúdo já sai com o conteúdo escolhido', () => {
    expect(opcoesDeCaptura(PRESET_DO_CONTEUDO.texto).contentHint).toBe('text')
    expect(opcoesDeCaptura(PRESET_DO_CONTEUDO.movimento).contentHint).toBe('motion')
  })
})
