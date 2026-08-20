/**
 * Medidor da transmissão: bitrate e quadros *reais*, lidos do `getStats()` do próprio sender.
 *
 * Existe para o painel de qualidade parar de ser adivinhação. Um teto de 2 Mbps não significa
 * 2 Mbps saindo; 30 fps pedidos não significam 30 fps codificados. O que o encoder está de
 * fato fazendo só aparece no `outbound-rtp`, e é o que o usuário precisa ver ao mexer no
 * controle — inclusive `qualityLimitationReason`, que é o encoder dizendo por que desistiu.
 */

/** O mínimo do `RTCStatsReport` que este módulo usa — é o que deixa o teste montar um relatório à mão. */
export interface RelatorioDeEstatisticas {
  forEach(visitar: (valor: unknown, chave: string) => void): void
}

export interface AmostraDeSaida {
  emMs: number
  bytesEnviados: number
  quadrosEnviados: number
}

export type Limitacao = 'cpu' | 'banda' | 'outro'

export interface MedidaDeSaida {
  /** `null` enquanto não há duas amostras para comparar. */
  kbps: number | null
  fps: number | null
  largura: number | null
  altura: number | null
  limitadoPor: Limitacao | null
}

export const MEDIDA_VAZIA: MedidaDeSaida = {
  kbps: null,
  fps: null,
  largura: null,
  altura: null,
  limitadoPor: null,
}

const MOTIVOS: Record<string, Limitacao> = {
  cpu: 'cpu',
  bandwidth: 'banda',
  other: 'outro',
}

interface SaidaBruta {
  emMs: number
  bytesEnviados: number
  quadrosEnviados: number
  fpsRelatado: number | null
  largura: number | null
  altura: number | null
  limitadoPor: Limitacao | null
}

function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

/**
 * Junta os `outbound-rtp` de vídeo num só retrato.
 *
 * Com simulcast há um por camada: bytes somam (é tudo uplink gasto), enquanto resolução e fps
 * vêm da maior camada — é ela que descreve o que o melhor assinante recebe.
 */
function lerSaidaDeVideo(relatorio: RelatorioDeEstatisticas): SaidaBruta | null {
  let achou = false
  const bruta: SaidaBruta = {
    emMs: 0,
    bytesEnviados: 0,
    quadrosEnviados: 0,
    fpsRelatado: null,
    largura: null,
    altura: null,
    limitadoPor: null,
  }

  relatorio.forEach((valor) => {
    if (valor === null || typeof valor !== 'object') return
    const stat = valor as Record<string, unknown>
    if (stat.type !== 'outbound-rtp') return
    if (stat.kind !== 'video' && stat.mediaType !== 'video') return

    achou = true
    bruta.emMs = Math.max(bruta.emMs, numeroOuNulo(stat.timestamp) ?? 0)
    bruta.bytesEnviados += numeroOuNulo(stat.bytesSent) ?? 0
    bruta.quadrosEnviados += numeroOuNulo(stat.framesSent) ?? numeroOuNulo(stat.framesEncoded) ?? 0

    const altura = numeroOuNulo(stat.frameHeight)
    if (altura !== null && altura > (bruta.altura ?? 0)) {
      bruta.altura = altura
      bruta.largura = numeroOuNulo(stat.frameWidth)
      bruta.fpsRelatado = numeroOuNulo(stat.framesPerSecond)
    }

    const motivo = typeof stat.qualityLimitationReason === 'string' ? MOTIVOS[stat.qualityLimitationReason] : undefined
    if (motivo) bruta.limitadoPor = motivo
  })

  return achou ? bruta : null
}

/**
 * Uma leitura do medidor. Devolve a medida e a amostra que a próxima leitura vai usar como
 * base — a taxa só existe entre duas amostras, então a primeira chamada volta com `kbps` nulo.
 */
export function medirSaida(
  relatorio: RelatorioDeEstatisticas,
  anterior: AmostraDeSaida | null,
): { medida: MedidaDeSaida; amostra: AmostraDeSaida | null } {
  const bruta = lerSaidaDeVideo(relatorio)
  if (!bruta) return { medida: MEDIDA_VAZIA, amostra: null }

  const amostra: AmostraDeSaida = {
    emMs: bruta.emMs,
    bytesEnviados: bruta.bytesEnviados,
    quadrosEnviados: bruta.quadrosEnviados,
  }

  const medida: MedidaDeSaida = {
    kbps: null,
    fps: bruta.fpsRelatado,
    largura: bruta.largura,
    altura: bruta.altura,
    limitadoPor: bruta.limitadoPor,
  }

  const intervaloMs = anterior === null ? 0 : bruta.emMs - anterior.emMs
  if (intervaloMs > 0 && anterior !== null) {
    const segundos = intervaloMs / 1000
    medida.kbps = Math.round(((bruta.bytesEnviados - anterior.bytesEnviados) * 8) / segundos / 1000)
    // `framesPerSecond` só aparece no Chrome depois de alguns segundos de transmissão; até lá
    // a contagem de quadros entre amostras é a única resposta honesta.
    if (medida.fps === null) {
      medida.fps = Math.round((bruta.quadrosEnviados - anterior.quadrosEnviados) / segundos)
    }
  }

  return { medida, amostra }
}

export function formatarKbps(kbps: number | null): string {
  if (kbps === null) return '—'
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mb/s`
  return `${kbps} kb/s`
}

export const FRASE_DA_LIMITACAO: Record<Limitacao, string> = {
  cpu: 'limitado pela CPU',
  banda: 'limitado pela banda',
  outro: 'limitado',
}
