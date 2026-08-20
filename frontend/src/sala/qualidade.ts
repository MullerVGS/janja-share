/**
 * Controle de qualidade da transmissão de tela.
 *
 * O ajuste acontece em duas metades independentes, e é dessa separação que vem o "ao vivo":
 *
 *  - **captura** — `MediaStreamTrack.applyConstraints()` muda o que o navegador *capta*
 *    (altura e taxa de quadros na origem);
 *  - **encoder** — `RTCRtpSender.setParameters()` muda o que o encoder *manda*
 *    (teto de bitrate e a regra de degradação).
 *
 * Nenhuma das duas renegocia a sessão nem republica a faixa. O que republica é o codec — e
 * isso é assunto de `useCompartilhamento`.
 *
 * Dois eixos guiam o encoder. **Conteúdo** diz o que está na tela (`contentHint`): texto
 * pede nitidez de borda, movimento pede continuidade. **Ceder** diz o que jogar fora quando
 * não cabe (`degradationPreference`): quadros, e o texto continua legível com o scroll
 * travado; ou resolução, e o jogo continua fluido mais borrado. É também o eixo que o
 * governador degrada em degraus.
 */

export type Resolucao = 'nativa' | '1440p' | '1080p' | '720p' | '540p'
export type Conteudo = 'texto' | 'movimento'
export type Codec = 'vp9' | 'av1' | 'h264' | 'vp8'
export type Ceder = 'quadros' | 'resolucao'

export interface PerfilDeQualidade {
  conteudo: Conteudo
  codec: Codec
  resolucao: Resolucao
  /** Quadros por segundo pedidos à captura e ao encoder. */
  fps: number
  ceder: Ceder
  /** Teto de bitrate em kbps. */
  tetoKbps: number
}

interface OpcaoDeResolucao {
  valor: Resolucao
  rotulo: string
  /** Altura máxima da captura; `null` não restringe (a tela vai como o monitor entrega). */
  altura: number | null
}

/** Da maior para a menor: é a escada que o governador desce quando o eixo cedido é resolução. */
export const RESOLUCOES: readonly OpcaoDeResolucao[] = [
  { valor: 'nativa', rotulo: 'Nativa', altura: null },
  { valor: '1440p', rotulo: '1440p', altura: 1440 },
  { valor: '1080p', rotulo: '1080p', altura: 1080 },
  { valor: '720p', rotulo: '720p', altura: 720 },
  { valor: '540p', rotulo: '540p', altura: 540 },
]

export const OPCOES_DE_FPS: readonly number[] = [5, 15, 30, 60]

export const CONTEUDOS: Record<Conteudo, { rotulo: string; contentHint: 'text' | 'motion'; descricao: string }> = {
  texto: { rotulo: 'Texto', contentHint: 'text', descricao: 'código, terminal, documentos — borda nítida vale mais que quadro' },
  movimento: { rotulo: 'Movimento', contentHint: 'motion', descricao: 'jogo, vídeo — continuidade vale mais que borda' },
}

export const CODECS: Record<Codec, { rotulo: string; descricao: string; svc: boolean }> = {
  vp9: { rotulo: 'VP9', descricao: 'padrão: bom em texto e em movimento, camadas temporais para quem assiste devagar', svc: true },
  av1: { rotulo: 'AV1', descricao: 'o melhor em texto; pede mais CPU de quem compartilha', svc: true },
  h264: { rotulo: 'H.264', descricao: 'o caminho do encoder de hardware — alivia a CPU em 60 fps', svc: false },
  vp8: { rotulo: 'VP8', descricao: 'legado: só se os outros derem problema', svc: false },
}

export const CEDER: Record<Ceder, { rotulo: string; degradacao: RTCDegradationPreference; explicacao: string }> = {
  quadros: {
    rotulo: 'Quadros',
    degradacao: 'maintain-resolution',
    explicacao: 'Sob aperto cai o número de quadros e a resolução fica de pé — código e texto continuam legíveis.',
  },
  resolucao: {
    rotulo: 'Resolução',
    degradacao: 'maintain-framerate',
    explicacao: 'Sob aperto cai a resolução e o movimento fica de pé — bom para vídeo e jogo.',
  },
}

/**
 * Quem limita esta transmissão é o **upload residencial de quem compartilha** (tipicamente
 * 10–40 Mbps no Brasil), não o servidor: a VPS sobe ~1 Gbps medido, então o fan-out do SFU é
 * praticamente de graça. Não aperte os números abaixo "para poupar o servidor" — não é ele que dói.
 */

/** Limites do slider de teto, em kbps. O topo existe para quem tem fibra boa e quer 1440p60. */
export const TETO = {
  minimoKbps: 200,
  maximoKbps: 20_000,
  passoKbps: 100,
} as const

/**
 * Perfil de partida de cada conteúdo.
 *
 * Texto a 15 fps porque a tela típica aqui é editor e terminal: conteúdo que muda em blocos,
 * onde quadro gasto é banda tirada da legibilidade. Movimento quadruplica os quadros e sobe
 * o teto junto, e vai de H.264 porque é o codec que o encoder de hardware do Chrome pega — a
 * CPU de quem joga já está ocupada com o jogo.
 */
export const PRESET_DO_CONTEUDO: Record<Conteudo, PerfilDeQualidade> = {
  texto: { conteudo: 'texto', codec: 'vp9', resolucao: '1080p', fps: 15, ceder: 'quadros', tetoKbps: 2_500 },
  movimento: { conteudo: 'movimento', codec: 'h264', resolucao: '1080p', fps: 60, ceder: 'resolucao', tetoKbps: 8_000 },
}

export const PERFIL_PADRAO: PerfilDeQualidade = PRESET_DO_CONTEUDO.texto

/**
 * Troca de conteúdo aplicando o preset do novo — menos a resolução, que continua sendo a
 * escolha da pessoa sobre a própria tela. Devolver 1080p a quem desceu para 720p justamente
 * porque a rede estava ruim seria o pior momento possível para ser prestativo.
 */
export function trocarConteudo(atual: PerfilDeQualidade, conteudo: Conteudo): PerfilDeQualidade {
  return { ...PRESET_DO_CONTEUDO[conteudo], resolucao: atual.resolucao }
}

export function alturaDaResolucao(resolucao: Resolucao): number | null {
  return RESOLUCOES.find((opcao) => opcao.valor === resolucao)?.altura ?? null
}

export function resolucaoDaAltura(altura: number): Resolucao | null {
  return RESOLUCOES.find((opcao) => opcao.altura === altura)?.valor ?? null
}

/** O que vem do `localStorage` só vira perfil se for um perfil inteiro, campo a campo. */
export function ehPerfil(valor: unknown): valor is PerfilDeQualidade {
  if (valor === null || typeof valor !== 'object') return false
  const p = valor as Record<string, unknown>
  return (
    typeof p.conteudo === 'string' &&
    p.conteudo in CONTEUDOS &&
    typeof p.codec === 'string' &&
    p.codec in CODECS &&
    typeof p.ceder === 'string' &&
    p.ceder in CEDER &&
    RESOLUCOES.some((opcao) => opcao.valor === p.resolucao) &&
    OPCOES_DE_FPS.includes(p.fps as number) &&
    typeof p.tetoKbps === 'number' &&
    p.tetoKbps >= TETO.minimoKbps &&
    p.tetoKbps <= TETO.maximoKbps
  )
}

/**
 * O perfil traduzido para a captura.
 *
 * Só a altura entra: restringir largura junto brigaria com a proporção do monitor
 * compartilhado. `max` e não `ideal` porque a intenção é teto, não alvo — uma tela 16:10 de
 * 1600px de altura deve descer para 1080, e uma de 900px deve ficar onde está.
 *
 * Em "Nativa" a altura simplesmente não aparece, e é assim que se volta atrás: o
 * `applyConstraints` troca o conjunto inteiro de restrições, então o que é omitido é liberado.
 */
export function restricoesDoPerfil(perfil: PerfilDeQualidade): MediaTrackConstraints {
  const altura = alturaDaResolucao(perfil.resolucao)
  return {
    frameRate: { max: perfil.fps },
    ...(altura === null ? {} : { height: { max: altura } }),
  }
}

/**
 * O perfil traduzido para o encoder, a partir dos parâmetros atuais do sender.
 *
 * Devolve um objeto novo preservando `transactionId` e a quantidade de encodings — o
 * `setParameters` recusa os dois se mudarem. O teto vai em *todos* os encodings: se um dia a
 * faixa for publicada com simulcast, nenhuma camada pode passar do que o usuário pediu.
 */
export function parametrosDoPerfil(
  atuais: RTCRtpSendParameters,
  perfil: PerfilDeQualidade,
): RTCRtpSendParameters {
  return {
    ...atuais,
    degradationPreference: CEDER[perfil.ceder].degradacao,
    encodings: (atuais.encodings ?? []).map((encoding) => ({
      ...encoding,
      maxBitrate: perfil.tetoKbps * 1000,
      maxFramerate: perfil.fps,
    })),
  }
}

export type EstadoDoAjuste = 'aplicado' | 'recusado' | 'indisponivel'

export interface RelatorioDeAplicacao {
  captura: EstadoDoAjuste
  encoder: EstadoDoAjuste
  /** Uma mensagem por metade: as duas falham por motivos diferentes e a UI conta as duas. */
  falhaDaCaptura?: string
  falhaDoEncoder?: string
}

export interface AlvoDeQualidade {
  faixa?: MediaStreamTrack
  remetente?: RTCRtpSender
}

/**
 * Aplica o perfil nas duas metades, cada uma independente da outra.
 *
 * As metades não se cancelam: um monitor que recusa 60 fps não pode impedir o teto de bitrate
 * de subir. Por isso o relatório é por metade, e a UI mostra o que de fato pegou.
 */
export async function aplicarPerfil(
  alvo: AlvoDeQualidade,
  perfil: PerfilDeQualidade,
): Promise<RelatorioDeAplicacao> {
  const relatorio: RelatorioDeAplicacao = { captura: 'indisponivel', encoder: 'indisponivel' }

  if (alvo.faixa) {
    // O `contentHint` é do track e vale mesmo se a restrição de captura for recusada — é ele
    // que diz ao encoder que o conteúdo é texto, e não fica preso ao `applyConstraints`.
    alvo.faixa.contentHint = CONTEUDOS[perfil.conteudo].contentHint
    try {
      await alvo.faixa.applyConstraints(restricoesDoPerfil(perfil))
      relatorio.captura = 'aplicado'
    } catch (erro) {
      relatorio.captura = 'recusado'
      relatorio.falhaDaCaptura = descrever(erro)
    }
  }

  if (alvo.remetente) {
    try {
      await alvo.remetente.setParameters(parametrosDoPerfil(alvo.remetente.getParameters(), perfil))
      relatorio.encoder = 'aplicado'
    } catch (erro) {
      relatorio.encoder = 'recusado'
      relatorio.falhaDoEncoder = descrever(erro)
    }
  }

  return relatorio
}

function descrever(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}
