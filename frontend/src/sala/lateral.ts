/** As abas da lateral da sala, na ordem em que aparecem. */
export type Aba = 'qualidade' | 'transmissao' | 'chat'

export const ABAS: readonly { valor: Aba; rotulo: string }[] = [
  { valor: 'qualidade', rotulo: 'Qualidade' },
  { valor: 'transmissao', rotulo: 'Transmissão' },
  { valor: 'chat', rotulo: 'Chat' },
]

export function ehAba(valor: unknown): valor is Aba {
  return ABAS.some((aba) => aba.valor === valor)
}

export const LARGURA_MINIMA_DA_LATERAL = 300

/** Entre o mínimo legível e metade da janela — o palco nunca vira a parte menor. */
export function limitarLargura(pedida: number, larguraDaJanela: number): number {
  return Math.max(LARGURA_MINIMA_DA_LATERAL, Math.min(Math.round(pedida), Math.floor(larguraDaJanela / 2)))
}
