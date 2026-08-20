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
 * Nenhuma das duas renegocia a sessão nem republica a faixa: mudar de perfil não pisca a
 * transmissão de quem está assistindo.
 *
 * O par (`contentHint`, `degradationPreference`) é a decisão que importa. Quando a banda não
 * cabe, o encoder precisa jogar algo fora, e essas duas propriedades escolhem *o quê*:
 * resolução ou quadros. Compartilhando código e terminal, jogar fora resolução transforma
 * texto em borrão irrecuperável; jogar fora quadros só deixa o scroll travado. Daí "Nitidez".
 */

export type Resolucao = 'nativa' | '1440p' | '1080p' | '720p'
export type Prioridade = 'nitidez' | 'fluidez'

export interface PerfilDeQualidade {
  resolucao: Resolucao
  /** Quadros por segundo pedidos à captura e ao encoder. */
  fps: number
  prioridade: Prioridade
  /** Teto de bitrate em kbps. */
  tetoKbps: number
}

interface OpcaoDeResolucao {
  valor: Resolucao
  rotulo: string
  /** Altura máxima da captura; `null` não restringe (a tela vai como o monitor entrega). */
  altura: number | null
}

export const RESOLUCOES: readonly OpcaoDeResolucao[] = [
  { valor: 'nativa', rotulo: 'Nativa', altura: null },
  { valor: '1440p', rotulo: '1440p', altura: 1440 },
  { valor: '1080p', rotulo: '1080p', altura: 1080 },
  { valor: '720p', rotulo: '720p', altura: 720 },
]

export const OPCOES_DE_FPS: readonly number[] = [5, 15, 30, 60]

interface Ajuste {
  rotulo: string
  contentHint: 'detail' | 'motion'
  degradacao: RTCDegradationPreference
  explicacao: string
}

export const PRIORIDADES: Record<Prioridade, Ajuste> = {
  nitidez: {
    rotulo: 'Nitidez',
    contentHint: 'detail',
    degradacao: 'maintain-resolution',
    explicacao: 'Sob banda ruim cai o número de quadros e a resolução fica de pé — código e texto continuam legíveis.',
  },
  fluidez: {
    rotulo: 'Fluidez',
    contentHint: 'motion',
    degradacao: 'maintain-framerate',
    explicacao: 'Sob banda ruim cai a resolução e o movimento fica de pé — bom para vídeo e jogo.',
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
  maximoKbps: 10_000,
  passoKbps: 100,
} as const

/**
 * Perfil de partida de cada prioridade — os dois modos da chave Nitidez ↔ Fluidez.
 *
 * Nitidez a 15 fps porque a tela típica aqui é editor e terminal: conteúdo que muda em blocos,
 * onde quadro gasto é banda tirada da legibilidade. Fluidez dobra os quadros e sobe o teto na
 * mesma proporção, senão o modo "movimento fluido" entregaria movimento borrado.
 */
export const PRESETS: Record<Prioridade, PerfilDeQualidade> = {
  nitidez: { resolucao: '1080p', fps: 15, prioridade: 'nitidez', tetoKbps: 2_500 },
  fluidez: { resolucao: '1080p', fps: 30, prioridade: 'fluidez', tetoKbps: 4_000 },
}

export const PERFIL_PADRAO: PerfilDeQualidade = PRESETS.nitidez

/**
 * Troca de prioridade aplicando o preset da nova — menos a resolução, que continua sendo a
 * escolha da pessoa sobre a própria tela. Devolver 1080p a quem desceu para 720p justamente
 * porque a rede estava ruim seria o pior momento possível para ser prestativo.
 */
export function trocarPrioridade(atual: PerfilDeQualidade, prioridade: Prioridade): PerfilDeQualidade {
  return { ...PRESETS[prioridade], resolucao: atual.resolucao }
}

export function alturaDaResolucao(resolucao: Resolucao): number | null {
  return RESOLUCOES.find((opcao) => opcao.valor === resolucao)?.altura ?? null
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
    degradationPreference: PRIORIDADES[perfil.prioridade].degradacao,
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
  /** Primeira falha encontrada, para a UI dizer o que não pegou em vez de mentir sucesso. */
  falha?: string
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
    alvo.faixa.contentHint = PRIORIDADES[perfil.prioridade].contentHint
    try {
      await alvo.faixa.applyConstraints(restricoesDoPerfil(perfil))
      relatorio.captura = 'aplicado'
    } catch (erro) {
      relatorio.captura = 'recusado'
      relatorio.falha ??= descrever(erro)
    }
  }

  if (alvo.remetente) {
    try {
      await alvo.remetente.setParameters(parametrosDoPerfil(alvo.remetente.getParameters(), perfil))
      relatorio.encoder = 'aplicado'
    } catch (erro) {
      relatorio.encoder = 'recusado'
      relatorio.falha ??= descrever(erro)
    }
  }

  return relatorio
}

function descrever(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}
