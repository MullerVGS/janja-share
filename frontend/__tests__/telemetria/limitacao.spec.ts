import { describe, expect, it } from 'vitest'
import { amostraVaziaDoEmissor } from '../../src/telemetria/amostra'
import { inferirLimitacao } from '../../src/telemetria/limitacao'

const PEDIDO = { tetoKbps: 8_000, fps: 60 }

/** O caso real medido em 2026-08-31: Firefox 153, H.264 por software, 1080p de jogo. */
function comoOTutti() {
  return { ...amostraVaziaDoEmissor(1_000), kbps: 700, fpsCodificado: 12, fpsCaptura: 60, perda: 0 }
}

describe('inferirLimitacao', () => {
  it('acusa cpu quando o encoder entrega pouco e deixa quadros para trás com a rede limpa', () => {
    expect(inferirLimitacao(comoOTutti(), PEDIDO)).toBe('cpu')
  })

  it('não acusa nada com a tela parada: poucos bits, mas o encoder acompanha a fonte', () => {
    const parada = { ...amostraVaziaDoEmissor(1_000), kbps: 200, fpsCodificado: 5, fpsCaptura: 5, perda: 0 }
    expect(inferirLimitacao(parada, PEDIDO)).toBeNull()
  })

  it('acusa banda quando a rede perde, mesmo com o encoder usando todo o teto', () => {
    const saudavel = { ...amostraVaziaDoEmissor(1_000), kbps: 8_000, fpsCodificado: 60, fpsCaptura: 60, perda: 5 }
    expect(inferirLimitacao(saudavel, PEDIDO)).toBe('banda')
  })

  it('não acusa nada quando o encoder usa o teto e a rede está limpa', () => {
    const bom = { ...amostraVaziaDoEmissor(1_000), kbps: 7_000, fpsCodificado: 58, fpsCaptura: 60, perda: 0 }
    expect(inferirLimitacao(bom, PEDIDO)).toBeNull()
  })

  it('sem fpsCaptura, estima pelo fps pedido e exige aproveitamento ainda mais baixo', () => {
    const semFonte = { ...amostraVaziaDoEmissor(1_000), kbps: 700, fpsCodificado: 12, fpsCaptura: null, perda: 0 }
    expect(inferirLimitacao(semFonte, PEDIDO)).toBe('cpu')

    const naDuvida = { ...amostraVaziaDoEmissor(1_000), kbps: 3_000, fpsCodificado: 12, fpsCaptura: null, perda: 0 }
    expect(inferirLimitacao(naDuvida, PEDIDO)).toBeNull()
  })

  it('ignora a amostra pausada pelo dynacast', () => {
    expect(inferirLimitacao({ ...comoOTutti(), ativo: false }, PEDIDO)).toBeNull()
  })

  it('não usa alvoKbps como régua: alvo baixo entregue por inteiro ainda é cpu', () => {
    expect(inferirLimitacao({ ...comoOTutti(), alvoKbps: 700 }, PEDIDO)).toBe('cpu')
  })

  it('sem kbps medido não há veredicto', () => {
    expect(inferirLimitacao({ ...comoOTutti(), kbps: null }, PEDIDO)).toBeNull()
  })
})
