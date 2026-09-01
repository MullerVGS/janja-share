import { alturaDaResolucao, CODECS, type Codec, type PerfilDeQualidade } from './qualidade'

/**
 * Qual codec esta máquina deve usar — perguntando ao navegador o que ele sabe fazer, nunca quem
 * ele é.
 *
 * Farejar `userAgent` responderia a pergunta errada. O que decide não é a marca do navegador e
 * sim a implementação do encoder embaixo dele: o mesmo H.264 que pega o encoder de hardware num
 * Chrome cai no OpenH264 por software num Firefox, e a diferença medida em produção foi de 7,7
 * Mbps para 0,7 Mbps na mesma Sala, na mesma noite.
 *
 * A consulta de capacidade tem um limite que vale conhecer: o navegador responde `smooth` e
 * `powerEfficient` para qualquer configuração suportada **enquanto não tiver estatísticas
 * daquele aparelho**. Numa máquina fria ela é otimista por construção — teria aprovado H.264 no
 * computador que deu origem a este módulo. Por isso a partida é palpite, e quem sabe a verdade é
 * a correção, que vem da telemetria.
 */

/**
 * Os três que qualquer navegador atual decodifica. AV1 fica de fora de propósito: ele existe no
 * painel para quem sabe o que quer, mas ninguém pode ficar sem imagem por uma decisão que a
 * máquina tomou sozinha.
 */
export const CODECS_DO_AUTOMATICO: readonly Codec[] = ['vp9', 'h264', 'vp8']

/**
 * O padrão quando não se sabe nada — e a escolha é pela assimetria do custo de errar, não por
 * VP9 ser melhor em abstrato. Errar para VP9 numa máquina que tinha H.264 por hardware gasta
 * mais CPU e ninguém percebe; errar para H.264 numa máquina que não tem deixa a transmissão
 * inassistível até a correção agir. Um erro é invisível, o outro é um amigo perguntando o que
 * aconteceu com a imagem.
 *
 * VP9 é também o único dos três que faz SVC, que `opcoesDePublicacao` explora com `L3T3_KEY`.
 */
export const CODEC_PADRAO: Codec = 'vp9'

export interface CapacidadeDoCodec {
  codec: Codec
  suportado: boolean
  /** `supported && smooth && powerEfficient` — o navegador diz que esta máquina faz sem sofrer. */
  eficiente: boolean
}

interface Veredicto {
  supported: boolean
  smooth: boolean
  powerEfficient: boolean
}

/** O que o navegador sabe empacotar; vazio quando a API não existe — e vazio não é "nenhum". */
function mimesSuportados(): Set<string> {
  try {
    const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs ?? []
    return new Set(codecs.map((codec) => codec.mimeType.toLowerCase()))
  } catch {
    return new Set()
  }
}

/**
 * O Firefox implementa esta API com o nome não-padrão `transmission` no lugar de `webrtc`.
 * Tentar os dois é ler capacidade, não farejar navegador — o segundo é sinônimo do primeiro, e
 * quem responde a qualquer um deles respondeu à mesma pergunta.
 */
const TIPOS_DE_ENCODING = ['webrtc', 'transmission'] as const

async function perguntar(mime: string, perfil: PerfilDeQualidade): Promise<Veredicto | null> {
  const capacidades = globalThis.navigator?.mediaCapabilities
  if (!capacidades?.encodingInfo) return null

  const altura = alturaDaResolucao(perfil.resolucao) ?? 1080
  const video = {
    contentType: mime,
    width: Math.round((altura * 16) / 9),
    height: altura,
    bitrate: perfil.tetoKbps * 1000,
    framerate: perfil.fps,
  }

  for (const type of TIPOS_DE_ENCODING) {
    try {
      const resposta = await capacidades.encodingInfo({ type, video } as never)
      return {
        supported: Boolean(resposta.supported),
        smooth: Boolean(resposta.smooth),
        powerEfficient: Boolean(resposta.powerEfficient),
      }
    } catch {
      // Nome recusado: tenta o próximo.
    }
  }
  return null
}

export async function sondarCapacidades(perfil: PerfilDeQualidade): Promise<CapacidadeDoCodec[]> {
  const mimes = mimesSuportados()
  return Promise.all(
    CODECS_DO_AUTOMATICO.map(async (codec) => {
      const mime = CODECS[codec].mime
      // Lista vazia é ausência de informação, não ausência de suporte: sem o `getCapabilities`
      // o certo é seguir e deixar a telemetria julgar, não declarar a máquina incapaz de tudo.
      const suportado = mimes.size === 0 || mimes.has(mime.toLowerCase())
      if (!suportado) return { codec, suportado: false, eficiente: false }
      const veredicto = await perguntar(mime, perfil)
      return {
        codec,
        suportado: veredicto === null ? true : veredicto.supported,
        eficiente: veredicto !== null && veredicto.supported && veredicto.smooth && veredicto.powerEfficient,
      }
    }),
  )
}

/**
 * O melhor entre os elegíveis: o primeiro `eficiente` na ordem de `CODECS_DO_AUTOMATICO` e, se
 * nenhum for, o primeiro suportado. `null` só quando não sobrou ninguém.
 */
function melhorEntre(capacidades: readonly CapacidadeDoCodec[], excluir?: Codec): Codec | null {
  const elegiveis = capacidades.filter((cap) => cap.suportado && cap.codec !== excluir)
  const naOrdem = CODECS_DO_AUTOMATICO.filter((codec) => elegiveis.some((cap) => cap.codec === codec))
  const eficiente = naOrdem.find((codec) => elegiveis.find((cap) => cap.codec === codec)?.eficiente)
  return eficiente ?? naOrdem[0] ?? null
}

export async function codecDePartida(opcoes: {
  preferido: 'auto' | Codec
  aprendido: Codec | null
  perfil: PerfilDeQualidade
}): Promise<Codec> {
  if (opcoes.preferido !== 'auto') return opcoes.preferido

  const capacidades = await sondarCapacidades(opcoes.perfil)
  const aprendido = opcoes.aprendido
  if (aprendido && capacidades.some((cap) => cap.codec === aprendido && cap.suportado)) return aprendido

  return melhorEntre(capacidades) ?? CODEC_PADRAO
}

/** O candidato da correção única: o melhor que não seja o que está falhando agora. */
export async function escolherCorrecao(atual: Codec, perfil: PerfilDeQualidade): Promise<Codec | null> {
  return melhorEntre(await sondarCapacidades(perfil), atual)
}
