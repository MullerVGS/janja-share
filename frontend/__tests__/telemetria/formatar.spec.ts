import { describe, expect, it } from 'vitest'
import { formatarKbps, formatarMs, formatarPct, formatarResolucao } from '../../src/telemetria/formatar'

describe('formatação das medidas', () => {
  it('mostra travessão enquanto não há medida', () => {
    expect(formatarKbps(null)).toBe('—')
    expect(formatarMs(null)).toBe('—')
    expect(formatarPct(null)).toBe('—')
    expect(formatarResolucao(null, null)).toBe('—')
  })

  it('vira Mb/s acima de mil, com vírgula decimal', () => {
    expect(formatarKbps(2500)).toBe('2,5 Mb/s')
    expect(formatarKbps(3000)).toBe('3,0 Mb/s')
    expect(formatarKbps(640)).toBe('640 kb/s')
  })

  it('milissegundos inteiros e porcentagem com uma casa', () => {
    expect(formatarMs(42.4)).toBe('42 ms')
    expect(formatarMs(8.25)).toBe('8,3 ms')
    expect(formatarPct(0)).toBe('0%')
    expect(formatarPct(2.5)).toBe('2,5%')
  })

  it('resolução como largura×altura; sem largura, só a altura com p', () => {
    expect(formatarResolucao(1920, 1080)).toBe('1920×1080')
    expect(formatarResolucao(null, 720)).toBe('720p')
  })
})
