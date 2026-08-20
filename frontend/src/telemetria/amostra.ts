/**
 * Normalizadores puros: `RTCStatsReport` → amostra fechada.
 *
 * O relatório do navegador é um saco de contadores acumulados. O que interessa à tela são
 * taxas, e taxa é diferença entre duas leituras — por isso cada leitura devolve também a
 * `base` que a próxima vai usar, e a primeira leitura de uma transmissão não tem taxa nenhuma.
 */

/** O mínimo do `RTCStatsReport` que este módulo usa — é o que deixa o teste montar um relatório à mão. */
export interface RelatorioDeEstatisticas {
  forEach(visitar: (valor: unknown, chave: string) => void): void
}

export type Limitacao = 'cpu' | 'banda' | 'outro'
export type Protocolo = 'udp' | 'tcp'

export interface AmostraDoEmissor {
  emMs: number
  fpsCodificado: number | null
  /** Quadros que a fonte entregou. Baixo sem limitação = tela parada, não encoder cansado. */
  fpsCaptura: number | null
  kbps: number | null
  largura: number | null
  altura: number | null
  larguraDaCaptura: number | null
  alturaDaCaptura: number | null
  limitadoPor: Limitacao | null
  /** Acumulado desde o início da publicação, como o navegador conta. */
  limitacaoSegundos: { nenhuma: number; cpu: number; banda: number; outro: number }
  mudancasDeResolucao: number
  encodeMsPorQuadro: number | null
  /** `false` = dynacast pausou o encoding porque ninguém assina. */
  ativo: boolean
  codec: string | null
  perfilDoCodec: string | null
  encoder: string | null
  encoderEmHardware: boolean | null
  escalabilidade: string | null
  /** Bitrate que o encoder está mirando agora (`targetBitrate`). */
  alvoKbps: number | null
  rtt: number | null
  /** Pacotes perdidos em %, segundo o último RTCP de quem recebe. */
  perda: number | null
  jitterMs: number | null
  bandaDisponivelKbps: number | null
  protocolo: Protocolo | null
  tipoDeCandidato: string | null
  robustez: { quadrosChave: number; pli: number; nack: number; fir: number }
}

export interface AmostraDoEspectador {
  emMs: number
  fpsDecodificado: number | null
  fpsRecebido: number | null
  kbps: number | null
  quadrosDescartados: number
  freezes: { quantidade: number; duracaoMs: number }
  /** Desvio padrão do intervalo entre quadros: a estabilidade como quem assiste sente. */
  desvioEntreQuadrosMs: number | null
  atrasoDoBufferMs: number | null
  /** Pacotes perdidos em % no intervalo. */
  perda: number | null
  jitterMs: number | null
  largura: number | null
  altura: number | null
  codec: string | null
  decoder: string | null
  decoderEmHardware: boolean | null
  rtt: number | null
  protocolo: Protocolo | null
}

/** Contadores acumulados da leitura anterior — só o que vira taxa na próxima. */
export interface BaseDoEmissor {
  emMs: number
  bytes: number
  quadros: number
  segundosDeEncode: number
  quadrosCapturados: number | null
}

export interface BaseDoEspectador {
  emMs: number
  bytes: number
  decodificados: number
  recebidos: number
  pacotesRecebidos: number
  pacotesPerdidos: number
  atrasoDoBuffer: number
  emitidosDoBuffer: number
  intervaloTotal: number
  intervaloQuadradoTotal: number
}

type Stat = Record<string, unknown>

const MOTIVOS: Record<string, Limitacao> = { cpu: 'cpu', bandwidth: 'banda', other: 'outro' }

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null
}

function booleano(valor: unknown): boolean | null {
  return typeof valor === 'boolean' ? valor : null
}

function ehVideo(stat: Stat): boolean {
  return stat.kind === 'video' || stat.mediaType === 'video'
}

function coletar(relatorio: RelatorioDeEstatisticas): Map<string, Stat> {
  const stats = new Map<string, Stat>()
  relatorio.forEach((valor, chave) => {
    if (valor !== null && typeof valor === 'object') stats.set(chave, valor as Stat)
  })
  return stats
}

function doTipo(stats: Map<string, Stat>, tipo: string): Stat[] {
  return [...stats.values()].filter((stat) => stat.type === tipo)
}

/** `video/VP9` → `VP9`. */
function nomeDoCodec(stats: Map<string, Stat>, codecId: unknown): { codec: string | null; perfil: string | null } {
  const codec = typeof codecId === 'string' ? stats.get(codecId) : undefined
  const mime = texto(codec?.mimeType)
  return { codec: mime ? (mime.split('/')[1] ?? mime) : null, perfil: texto(codec?.sdpFmtpLine) }
}

interface Rede {
  rtt: number | null
  bandaDisponivelKbps: number | null
  protocolo: Protocolo | null
  tipoDeCandidato: string | null
}

/** O par de candidatos em uso é o nominado que deu certo; o `local-candidate` dele diz UDP×TCP. */
function lerRede(stats: Map<string, Stat>): Rede {
  const par = doTipo(stats, 'candidate-pair').find((stat) => stat.nominated === true && stat.state === 'succeeded')
  const local = typeof par?.localCandidateId === 'string' ? stats.get(par.localCandidateId) : undefined
  const protocolo = texto(local?.protocol)?.toLowerCase()
  const banda = numero(par?.availableOutgoingBitrate)
  return {
    rtt: emMs(numero(par?.currentRoundTripTime)),
    bandaDisponivelKbps: banda === null ? null : Math.round(banda / 1000),
    protocolo: protocolo === 'udp' || protocolo === 'tcp' ? protocolo : null,
    tipoDeCandidato: texto(local?.candidateType),
  }
}

function emMs(segundos: number | null): number | null {
  return segundos === null ? null : Math.round(segundos * 1000)
}

function emPorcento(fracao: number | null): number | null {
  return fracao === null ? null : Math.round(fracao * 1000) / 10
}

function kbpsEntre(bytes: number, segundos: number): number {
  return Math.round((bytes * 8) / segundos / 1000)
}

function porSegundo(quantidade: number, segundos: number): number {
  return Math.round(quantidade / segundos)
}

export function amostraVaziaDoEmissor(emMs: number, ativo = true): AmostraDoEmissor {
  return {
    emMs,
    fpsCodificado: null,
    fpsCaptura: null,
    kbps: null,
    largura: null,
    altura: null,
    larguraDaCaptura: null,
    alturaDaCaptura: null,
    limitadoPor: null,
    limitacaoSegundos: { nenhuma: 0, cpu: 0, banda: 0, outro: 0 },
    mudancasDeResolucao: 0,
    encodeMsPorQuadro: null,
    ativo,
    codec: null,
    perfilDoCodec: null,
    encoder: null,
    encoderEmHardware: null,
    escalabilidade: null,
    alvoKbps: null,
    rtt: null,
    perda: null,
    jitterMs: null,
    bandaDisponivelKbps: null,
    protocolo: null,
    tipoDeCandidato: null,
    robustez: { quadrosChave: 0, pli: 0, nack: 0, fir: 0 },
  }
}

export function amostraVaziaDoEspectador(emMs: number): AmostraDoEspectador {
  return {
    emMs,
    fpsDecodificado: null,
    fpsRecebido: null,
    kbps: null,
    quadrosDescartados: 0,
    freezes: { quantidade: 0, duracaoMs: 0 },
    desvioEntreQuadrosMs: null,
    atrasoDoBufferMs: null,
    perda: null,
    jitterMs: null,
    largura: null,
    altura: null,
    codec: null,
    decoder: null,
    decoderEmHardware: null,
    rtt: null,
    protocolo: null,
  }
}

/**
 * Lê o `getStats()` do sender da tela.
 *
 * `ativo` vem de fora (`sender.getParameters().encodings[0].active`): o dynacast desliga o
 * encoding quando ninguém assina e o relatório passa a mostrar 0 fps sem dizer por quê.
 *
 * Com mais de uma camada (`outbound-rtp` por rid) os bytes somam — é tudo uplink — e o resto
 * descreve a maior, que é o que o melhor assinante recebe.
 */
export function lerAmostraDoEmissor(
  relatorio: RelatorioDeEstatisticas,
  anterior: BaseDoEmissor | null,
  ativo: boolean,
): { amostra: AmostraDoEmissor; base: BaseDoEmissor | null } {
  const stats = coletar(relatorio)
  const camadas = doTipo(stats, 'outbound-rtp').filter(ehVideo)
  if (camadas.length === 0) return { amostra: amostraVaziaDoEmissor(Date.now(), ativo), base: null }

  const maior = camadas.reduce((a, b) => ((numero(b.frameHeight) ?? 0) > (numero(a.frameHeight) ?? 0) ? b : a))
  const agora = Math.max(...camadas.map((camada) => numero(camada.timestamp) ?? 0))
  const bytes = camadas.reduce((soma, camada) => soma + (numero(camada.bytesSent) ?? 0), 0)
  const quadros = numero(maior.framesEncoded) ?? 0
  const segundosDeEncode = numero(maior.totalEncodeTime) ?? 0

  const fonte = doTipo(stats, 'media-source').find(ehVideo)
  const quadrosCapturados = numero(fonte?.frames)
  const remoto = doTipo(stats, 'remote-inbound-rtp').find(ehVideo)
  const rede = lerRede(stats)
  const duracoes = (maior.qualityLimitationDurations ?? {}) as Stat
  const motivo = typeof maior.qualityLimitationReason === 'string' ? MOTIVOS[maior.qualityLimitationReason] : undefined
  const codec = nomeDoCodec(stats, maior.codecId)
  const alvo = numero(maior.targetBitrate)

  const amostra: AmostraDoEmissor = {
    ...amostraVaziaDoEmissor(agora, ativo),
    fpsCodificado: numero(maior.framesPerSecond),
    fpsCaptura: numero(fonte?.framesPerSecond),
    largura: numero(maior.frameWidth),
    altura: numero(maior.frameHeight),
    larguraDaCaptura: numero(fonte?.width),
    alturaDaCaptura: numero(fonte?.height),
    limitadoPor: motivo ?? null,
    limitacaoSegundos: {
      nenhuma: numero(duracoes.none) ?? 0,
      cpu: numero(duracoes.cpu) ?? 0,
      banda: numero(duracoes.bandwidth) ?? 0,
      outro: numero(duracoes.other) ?? 0,
    },
    mudancasDeResolucao: numero(maior.qualityLimitationResolutionChanges) ?? 0,
    codec: codec.codec,
    perfilDoCodec: codec.perfil,
    encoder: texto(maior.encoderImplementation),
    encoderEmHardware: booleano(maior.powerEfficientEncoder),
    escalabilidade: texto(maior.scalabilityMode),
    alvoKbps: alvo === null ? null : Math.round(alvo / 1000),
    rtt: emMs(numero(remoto?.roundTripTime)) ?? rede.rtt,
    perda: emPorcento(numero(remoto?.fractionLost)),
    jitterMs: emMs(numero(remoto?.jitter)),
    bandaDisponivelKbps: rede.bandaDisponivelKbps,
    protocolo: rede.protocolo,
    tipoDeCandidato: rede.tipoDeCandidato,
    robustez: {
      quadrosChave: numero(maior.keyFramesEncoded) ?? 0,
      pli: numero(maior.pliCount) ?? 0,
      nack: numero(maior.nackCount) ?? 0,
      fir: numero(maior.firCount) ?? 0,
    },
  }

  const segundos = anterior === null ? 0 : (agora - anterior.emMs) / 1000
  if (anterior !== null && segundos > 0) {
    amostra.kbps = kbpsEntre(bytes - anterior.bytes, segundos)
    const novos = quadros - anterior.quadros
    // `framesPerSecond` só aparece no Chrome depois de alguns segundos de transmissão; até lá
    // a contagem de quadros entre amostras é a única resposta honesta.
    if (amostra.fpsCodificado === null) amostra.fpsCodificado = porSegundo(novos, segundos)
    if (amostra.fpsCaptura === null && quadrosCapturados !== null && anterior.quadrosCapturados !== null) {
      amostra.fpsCaptura = porSegundo(quadrosCapturados - anterior.quadrosCapturados, segundos)
    }
    if (novos > 0) {
      amostra.encodeMsPorQuadro = Math.round(((segundosDeEncode - anterior.segundosDeEncode) / novos) * 1000 * 10) / 10
    }
  }

  return { amostra, base: { emMs: agora, bytes, quadros, segundosDeEncode, quadrosCapturados } }
}

/** Lê o `getStats()` do receiver de uma tela assinada. */
export function lerAmostraDoEspectador(
  relatorio: RelatorioDeEstatisticas,
  anterior: BaseDoEspectador | null,
): { amostra: AmostraDoEspectador; base: BaseDoEspectador | null } {
  const stats = coletar(relatorio)
  const entrada = doTipo(stats, 'inbound-rtp').find(ehVideo)
  if (!entrada) return { amostra: amostraVaziaDoEspectador(Date.now()), base: null }

  const agora = numero(entrada.timestamp) ?? 0
  const rede = lerRede(stats)
  const base: BaseDoEspectador = {
    emMs: agora,
    bytes: numero(entrada.bytesReceived) ?? 0,
    decodificados: numero(entrada.framesDecoded) ?? 0,
    recebidos: numero(entrada.framesReceived) ?? 0,
    pacotesRecebidos: numero(entrada.packetsReceived) ?? 0,
    pacotesPerdidos: numero(entrada.packetsLost) ?? 0,
    atrasoDoBuffer: numero(entrada.jitterBufferDelay) ?? 0,
    emitidosDoBuffer: numero(entrada.jitterBufferEmittedCount) ?? 0,
    intervaloTotal: numero(entrada.totalInterFrameDelay) ?? 0,
    intervaloQuadradoTotal: numero(entrada.totalSquaredInterFrameDelay) ?? 0,
  }

  const amostra: AmostraDoEspectador = {
    ...amostraVaziaDoEspectador(agora),
    fpsDecodificado: numero(entrada.framesPerSecond),
    quadrosDescartados: numero(entrada.framesDropped) ?? 0,
    freezes: {
      quantidade: numero(entrada.freezeCount) ?? 0,
      duracaoMs: emMs(numero(entrada.totalFreezesDuration)) ?? 0,
    },
    jitterMs: emMs(numero(entrada.jitter)),
    largura: numero(entrada.frameWidth),
    altura: numero(entrada.frameHeight),
    codec: nomeDoCodec(stats, entrada.codecId).codec,
    decoder: texto(entrada.decoderImplementation),
    decoderEmHardware: booleano(entrada.powerEfficientDecoder),
    rtt: rede.rtt,
    protocolo: rede.protocolo,
  }

  const segundos = anterior === null ? 0 : (agora - anterior.emMs) / 1000
  if (anterior !== null && segundos > 0) {
    amostra.kbps = kbpsEntre(base.bytes - anterior.bytes, segundos)
    const decodificados = base.decodificados - anterior.decodificados
    if (amostra.fpsDecodificado === null) amostra.fpsDecodificado = porSegundo(decodificados, segundos)
    amostra.fpsRecebido = porSegundo(base.recebidos - anterior.recebidos, segundos)

    const emitidos = base.emitidosDoBuffer - anterior.emitidosDoBuffer
    if (emitidos > 0) {
      amostra.atrasoDoBufferMs = Math.round(((base.atrasoDoBuffer - anterior.atrasoDoBuffer) / emitidos) * 1000)
    }

    const perdidos = base.pacotesPerdidos - anterior.pacotesPerdidos
    const recebidos = base.pacotesRecebidos - anterior.pacotesRecebidos
    if (perdidos + recebidos > 0) amostra.perda = emPorcento(perdidos / (perdidos + recebidos))

    // Desvio padrão do intervalo entre quadros a partir dos totais acumulados: Var = E[x²] − E[x]².
    if (decodificados > 0) {
      const media = (base.intervaloTotal - anterior.intervaloTotal) / decodificados
      const mediaDosQuadrados = (base.intervaloQuadradoTotal - anterior.intervaloQuadradoTotal) / decodificados
      amostra.desvioEntreQuadrosMs = Math.sqrt(Math.max(0, mediaDosQuadrados - media * media)) * 1000
    }
  }

  return { amostra, base }
}
