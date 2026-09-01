/** As abas da gaveta da sala, na ordem em que aparecem — a conversa primeiro, que é o uso comum. */
export type Aba = 'qualidade' | 'metricas' | 'chat'

export const ABAS: readonly { valor: Aba; rotulo: string }[] = [
  { valor: 'chat', rotulo: 'Conversa' },
  { valor: 'qualidade', rotulo: 'Qualidade' },
  { valor: 'metricas', rotulo: 'Métricas' },
]

export const LARGURA_MINIMA_DA_LATERAL = 300

/** Entre o mínimo legível e metade da janela — o palco nunca vira a parte menor. */
export function limitarLargura(pedida: number, larguraDaJanela: number): number {
  return Math.max(LARGURA_MINIMA_DA_LATERAL, Math.min(Math.round(pedida), Math.floor(larguraDaJanela / 2)))
}

export interface EstadoDaLateral {
  aberta: boolean
  aba: Aba
}

/** O botão da barra é um interruptor da sua aba: abre nela, e fecha se ela já está à mostra. */
export function alternarAba(estado: EstadoDaLateral, aba: Aba): EstadoDaLateral {
  if (estado.aberta && estado.aba === aba) return { ...estado, aberta: false }
  return { aberta: true, aba }
}
