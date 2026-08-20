import type { Limitacao } from './amostra'

/** Números da telemetria como a pessoa lê: vírgula decimal, unidade curta, travessão sem medida. */

const umaCasa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const ateUmaCasa = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function formatarKbps(kbps: number | null): string {
  if (kbps === null) return '—'
  if (kbps >= 1000) return `${umaCasa.format(kbps / 1000)} Mb/s`
  return `${Math.round(kbps)} kb/s`
}

export function formatarMs(ms: number | null): string {
  if (ms === null) return '—'
  return ms >= 10 ? `${Math.round(ms)} ms` : `${ateUmaCasa.format(ms)} ms`
}

export function formatarPct(pct: number | null): string {
  return pct === null ? '—' : `${ateUmaCasa.format(pct)}%`
}

export function formatarResolucao(largura: number | null, altura: number | null): string {
  if (altura === null) return '—'
  return largura === null ? `${altura}p` : `${largura}×${altura}`
}

export const FRASE_DA_LIMITACAO: Record<Limitacao, string> = {
  cpu: 'limitado pela CPU',
  banda: 'limitado pela banda',
  outro: 'limitado',
}
