import type { AmostraDoEmissor, AmostraDoEspectador } from '../telemetria/amostra'
import { sumiu, type Espectador } from '../telemetria/relato'
import { alturaDaResolucao, CODECS, resolucaoDaAltura, RESOLUCOES, TETO, type PerfilDeQualidade } from './qualidade'

/**
 * O governador: transforma a adaptação contínua do Chrome em degraus estáveis — e procura, em
 * degraus igualmente estáveis, o teto real do link de quem compartilha.
 *
 * O encoder já cede sozinho quando a CPU ou a banda não dão conta — mas cede oscilando, e 40–60
 * fps serrilhados são piores de assistir que 30 cravados. O governador olha a janela recente e,
 * quando a limitação é persistente **e** o eixo escolhido já está cedendo, pede de uma vez o
 * patamar que cabe. Sobe de volta com cautela, um degrau a cada 30 s limpos, e aprende: um
 * degrau que falhou logo depois de subir fica queimado até a pessoa mexer nos controles.
 *
 * Dois eixos, do mais barato ao mais caro, e sempre um por vez:
 *
 *  1. **bitrate** — invisível para quem assiste, e o único que também sobe: mira
 *     `ALVO_DA_BANDA` da banda medida, +25% a cada 30 s limpos, e desce a `PASSO_DA_DESCIDA`
 *     até o piso. Partir do teto inundaria o link nos primeiros segundos de toda live; partir
 *     baixo e subir é o que acha o teto real. Só vale contra **banda**: apertar o encoder não
 *     devolve ciclo de CPU nenhum, e sob CPU gastar uma janela nele é adiar o conserto;
 *  2. **quadros ou resolução** — o eixo que a pessoa escolheu ceder, em degraus.
 *
 * O áudio da tela não é eixo de nada: 128 kbps perto de megabits de vídeo é arredondamento, e
 * é o que as pessoas mais notam.
 *
 * Ele decide por duas vozes. A do emissor é a janela de amostras. A de quem assiste chega em
 * `espectadores`: o caso que o emissor sozinho não enxerga é encoder feliz, banda sobrando e um
 * amigo travando. Essa voz segura a subida com qualquer sinal — inclusive o ambíguo, porque não
 * subir é barato. Para **descer** ela precisa de perda de pacote, que só a rede explica; e nem
 * isso com codec SVC, porque aí o SFU já dá ao amigo lento uma camada menor.
 *
 * É uma função pura sobre estado serializável; o relógio é o das amostras (`emMs`), não o da
 * máquina. Quem alimenta é o hook, uma vez por amostra nova. O pedido da pessoa deixou de ser
 * teto e virou caráter: o de partida.
 */

export const JANELA = 5
export const MINIMO_LIMITADAS = 4
export const FOLGA = 0.9
export const SUBIR_APOS_MS = 30_000
export const QUEIMAR_SE_DESCER_EM_MS = 60_000
export const TETO_DE_DECISOES = 20

/** Quanto da banda medida o teto persegue. O que sobra é a margem que impede a fila de crescer. */
export const ALVO_DA_BANDA = 0.85
/** Cada degrau de subida do teto. Pequeno o bastante para o estimador da rede acompanhar. */
export const PASSO_DA_SUBIDA = 1.25
/** Cada degrau de descida do teto — e o piso, em fração do valor de partida do preset. */
export const PASSO_DA_DESCIDA = 0.6

/** Perda em % e desvio entre quadros em ms a partir dos quais quem assiste está sofrendo. */
export const PERDA_QUE_SOFRE = 3
export const DESVIO_QUE_SOFRE_MS = 80

export const DEGRAUS_DE_FPS: readonly number[] = [60, 45, 30, 24, 15, 10, 5]
export const DEGRAUS_DE_ALTURA: readonly number[] = RESOLUCOES.flatMap((opcao) => (opcao.altura === null ? [] : [opcao.altura]))

export type MotivoDoGovernador = 'cpu' | 'banda'

/**
 * O registro é do eixo cedido, não do bitrate: quem lê `decisoes` desenha marcas num gráfico de
 * fps ou de altura, e o teto já aparece por inteiro na linha de referência do gráfico de
 * bitrate. Misturar kbps aqui produziria "4000 fps → 2400 fps".
 */
export interface DecisaoDoGovernador {
  emMs: number
  /** Degrau antes e depois; `null` é o pedido inteiro. */
  de: number | null
  para: number | null
  /** Só a descida tem motivo; a subida é a ausência dele. */
  motivo: MotivoDoGovernador | null
}

export interface EstadoDoGovernador {
  /** Degrau em vigor no eixo cedido — fps ou altura; `null` = o pedido vale inteiro. */
  degrau: number | null
  /** Teto de bitrate achado pelo governador; `null` = o valor de partida do preset vale inteiro. */
  tetoKbps: number | null
  motivo: MotivoDoGovernador | null
  /** Degraus que falharam logo depois de uma subida; não se volta a eles até a pessoa mexer. */
  queimados: readonly number[]
  /**
   * A altura que a captura entregava antes do primeiro degrau de resolução. Com o degrau em
   * vigor a captura passa a entregar o degrau, e sem isto o governador não saberia até onde subir.
   */
  alturaSemDegrau: number | null
  /**
   * Instante (relógio das amostras) da última limitação ou decisão — ou da primeira amostra
   * vista, quando não houve nenhuma das duas: é de onde os 30 s contam.
   */
  limpoDesdeMs: number | null
  subiuEmMs: number | null
  /** A janela só conta amostras depois deste instante: as de antes já foram julgadas, ou são de antes de a pessoa mexer. */
  janelaDesdeMs: number | null
  decisoes: readonly DecisaoDoGovernador[]
}

export const GOVERNADOR_PARADO: EstadoDoGovernador = {
  degrau: null,
  tetoKbps: null,
  motivo: null,
  queimados: [],
  alturaSemDegrau: null,
  limpoDesdeMs: null,
  subiuEmMs: null,
  janelaDesdeMs: null,
  decisoes: [],
}

/** O que acontece quando a pessoa mexe num controle: tudo zera, e a próxima janela começa agora. */
export function zerarGovernador(historico: readonly AmostraDoEmissor[]): EstadoDoGovernador {
  const nova = historico[historico.length - 1]
  return nova ? { ...GOVERNADOR_PARADO, janelaDesdeMs: nova.emMs } : GOVERNADOR_PARADO
}

function motivoDe(amostra: AmostraDoEmissor): MotivoDoGovernador | null {
  if (!amostra.ativo) return null
  return amostra.limitadoPor === 'cpu' || amostra.limitadoPor === 'banda' ? amostra.limitadoPor : null
}

function media(valores: (number | null)[]): number | null {
  const validos = valores.filter((valor): valor is number => valor !== null)
  return validos.length === 0 ? null : validos.reduce((soma, valor) => soma + valor, 0) / validos.length
}

function menor(...valores: (number | null)[]): number | null {
  const validos = valores.filter((valor): valor is number => valor !== null)
  return validos.length === 0 ? null : Math.min(...validos)
}

/**
 * A voz de quem assiste, em dois predicados — e a assimetria entre eles é a regra inteira.
 *
 * Só entra sinal **do intervalo**: perda, desvio entre quadros e ausência de quadro são medidos
 * entre dois relatos e voltam a zero quando o problema passa. `freezes` é contador acumulado
 * desde a assinatura — qualquer limiar sobre ele gruda no primeiro engasgo e nunca mais solta, e
 * grudado ele faria o governador de H.264 descer até o chão com a sala inteira lisa.
 *
 * Quem sumiu não é levado em conta: relato velho descreve um problema que pode ter acabado — ou
 * uma pessoa que já saiu.
 */

/** Perda de pacote: o único sinal que só a rede explica. */
function temPerda(relato: AmostraDoEspectador): boolean {
  return (relato.perda ?? 0) > PERDA_QUE_SOFRE
}

/**
 * Quadros chegando fora de ritmo. É o congelamento medido por intervalo — mas é **ambíguo**: o
 * desvio é entre quadros *decodificados*, e uma fonte que entrega poucos quadros irregulares
 * (vídeo pausado, tela parada, jogo em fps baixo) passa de 80 ms com a rede impecável.
 */
function irregular(relato: AmostraDoEspectador): boolean {
  return (relato.desvioEntreQuadrosMs ?? 0) > DESVIO_QUE_SOFRE_MS
}

/**
 * Recepção parada de vez — o espectador mais prejudicado de todos, e o que some dos outros dois
 * sinais: sem quadro decodificado não há desvio (`amostra.ts`, `decodificados > 0`), e sem
 * pacote não há perda (`perdidos + recebidos === 0`). Os dois chegam `null`, e o relato de quem
 * não está vendo nada se parece com o de quem está ótimo.
 *
 * `=== 0`, e nunca `?? 0`: zero é medida ("houve leitura e nada veio no intervalo"), `null` é
 * ausência de medida — que é como chega o relato de quem não tem receiver naquela tela.
 */
function parado(relato: AmostraDoEspectador): boolean {
  return relato.fpsDecodificado === 0 && (relato.kbps ?? 0) === 0
}

/**
 * Segura a subida. Qualquer suspeita serve, inclusive a ambígua: não subir custa o que a pessoa
 * já tem, e é o lado barato de errar.
 */
export function alguemSofrendo(espectadores: readonly Espectador[], agora: number): boolean {
  return espectadores.some(
    (espectador) =>
      !sumiu(espectador, agora) &&
      (temPerda(espectador.relato) || irregular(espectador.relato) || parado(espectador.relato)),
  )
}

/**
 * Autoriza descer (sem SVC). Só perda: descer com base ambígua é caro e se repete — cada descida
 * reseta a janela, então uma tela parada num preset Jogo desceria um degrau a cada 5 s até o fim
 * da escada com a sala lisa.
 *
 * `parado` de fora de propósito: nada chegando não se conserta encolhendo o que se manda. Isso é
 * assinatura, e de assinatura cuida o cão de guarda da recepção.
 */
export function alguemPerdendo(espectadores: readonly Espectador[], agora: number): boolean {
  return espectadores.some((espectador) => !sumiu(espectador, agora) && temPerda(espectador.relato))
}

/** O teto que a banda medida permite. Sem medida não há alvo — e sem alvo não se sobe. */
function alvoDoTeto(janela: readonly AmostraDoEmissor[]): number | null {
  const banda = media(janela.map((amostra) => amostra.bandaDisponivelKbps))
  return banda === null ? null : Math.min(TETO.maximoKbps, Math.round(ALVO_DA_BANDA * banda))
}

/** O teto depois de um degrau de subida; `null` quando já chegou onde a banda deixa. */
function subirOTeto(estado: EstadoDoGovernador, pedido: PerfilDeQualidade, alvo: number | null): number | null {
  if (alvo === null) return null
  const atual = estado.tetoKbps ?? pedido.tetoKbps
  return atual >= alvo ? null : Math.min(alvo, Math.round(PASSO_DA_SUBIDA * atual))
}

/**
 * O teto depois de um degrau de descida; `null` quando já está no piso e a vez é do eixo caro.
 *
 * O piso é fração do valor de partida: abaixo dele apertar mais o encoder é entregar borrão em
 * vez de menos quadros, e a pessoa escolheu o que ceder.
 */
function descerOTeto(estado: EstadoDoGovernador, pedido: PerfilDeQualidade): number | null {
  const atual = estado.tetoKbps ?? pedido.tetoKbps
  const piso = Math.round(PASSO_DA_DESCIDA * pedido.tetoKbps)
  return atual <= piso ? null : Math.max(piso, Math.round(PASSO_DA_DESCIDA * atual))
}

/**
 * Até onde o eixo pode ir, pelo pedido. Em resolução, o pedido só vale até onde o monitor
 * entrega: pedir 1440p num monitor de 1080 não é o encoder cedendo.
 */
function tetoDoPedido(pedido: PerfilDeQualidade, estado: EstadoDoGovernador, janela: readonly AmostraDoEmissor[]): number | null {
  if (pedido.ceder === 'quadros') return pedido.fps
  const daCaptura = estado.alturaSemDegrau ?? media(janela.map((amostra) => amostra.alturaDaCaptura))
  return menor(alturaDaResolucao(pedido.resolucao), daCaptura)
}

function anotarDecisao(estado: EstadoDoGovernador, decisao: DecisaoDoGovernador): DecisaoDoGovernador[] {
  return [...estado.decisoes, decisao].slice(-TETO_DE_DECISOES)
}

export function decidir(
  estado: EstadoDoGovernador,
  historico: readonly AmostraDoEmissor[],
  pedido: PerfilDeQualidade,
  espectadores: readonly Espectador[] = [],
): EstadoDoGovernador {
  const nova = historico[historico.length - 1]
  if (!nova) return estado
  const agora = nova.emMs

  // Pausado pelo dynacast não é limitação: a amostra é ignorada, e o relógio segue.
  if (!nova.ativo) return estado

  const janela = historico
    .filter((amostra) => amostra.ativo && (estado.janelaDesdeMs === null || amostra.emMs > estado.janelaDesdeMs))
    .slice(-JANELA)
  const degraus = pedido.ceder === 'quadros' ? DEGRAUS_DE_FPS : DEGRAUS_DE_ALTURA
  const medidaDe = (amostra: AmostraDoEmissor) => (pedido.ceder === 'quadros' ? amostra.fpsCodificado : amostra.altura)
  const teto = tetoDoPedido(pedido, estado, janela)
  const alvo = estado.degrau ?? teto

  // Sem limitação e sem passado, os 30 s contam da primeira amostra: é o que permite a primeira
  // subida numa transmissão que nunca cedeu nada.
  const limpoDesdeMs = motivoDe(nova) !== null ? agora : (estado.limpoDesdeMs ?? agora)
  const sofrendo = alguemSofrendo(espectadores, agora)
  const perdendo = alguemPerdendo(espectadores, agora)

  const janelaCheia = janela.length >= JANELA
  const limitadas = janela.filter((amostra) => motivoDe(amostra) !== null)
  const medida = media(limitadas.map(medidaDe))
  // Em quadros, o encoder oscila perto do alvo e 0,9× separa ruído de cessão; em resolução
  // ele só muda por degraus grandes, e qualquer altura abaixo do alvo já é cessão.
  const cedendo = alvo !== null && medida !== null && (pedido.ceder === 'quadros' ? medida < FOLGA * alvo : medida < alvo)
  const doEmissor = janelaCheia && limitadas.length >= MINIMO_LIMITADAS && cedendo
  // Com SVC o SFU já dá ao amigo lento uma camada menor, e descer puniria a sala pelo link
  // dele. Sem SVC a camada é uma só: o pior espectador é o teto de todo mundo. A janela cheia
  // é o que impede um relato ruim solto de derrubar a transmissão.
  const doEspectador = janelaCheia && perdendo && !CODECS[pedido.codec].svc

  if (doEmissor || doEspectador) {
    const porBanda = limitadas.filter((amostra) => motivoDe(amostra) === 'banda').length
    const motivo: MotivoDoGovernador = doEmissor && porBanda * 2 <= limitadas.length ? 'cpu' : 'banda'

    // O bitrate vai primeiro: é o eixo que quem assiste não vê mexer. Só que ele não devolve
    // ciclo nenhum — sob CPU o único caminho é encodar menos, e gastar uma janela apertando o
    // encoder seria adiar o conserto e piorar a imagem de graça.
    //
    // `subiuEmMs` fica de pé de propósito: como o eixo cedido só sobe depois de o teto chegar ao
    // alvo, toda subida de degrau acontece com o teto acima do piso — e apagar a marca aqui
    // deixaria a queima morta justamente no link que subiu, devolvendo o serrilhado 30 ↔ 45.
    if (motivo === 'banda') {
      const menor = descerOTeto(estado, pedido)
      if (menor !== null) {
        return { ...estado, tetoKbps: menor, motivo, limpoDesdeMs: agora, janelaDesdeMs: agora }
      }
    }

    // Do emissor vem o patamar que cabe na medida; do espectador vem só "não deu": desce um.
    const para = doEmissor
      ? (medida === null ? null : (degraus.find((degrau) => degrau <= FOLGA * medida) ?? degraus[degraus.length - 1] ?? null))
      : (alvo === null ? null : (degraus.find((degrau) => degrau < alvo) ?? null))
    // Com o pedido no piso da escada não há para onde descer — e nada a dizer.
    if (alvo !== null && para !== null && para < alvo) {
      // Queima só o degrau que falhou logo depois de uma subida — nunca um alcançado por descida.
      const queimaAgora = estado.subiuEmMs !== null && agora - estado.subiuEmMs < QUEIMAR_SE_DESCER_EM_MS
      return {
        ...estado,
        degrau: para,
        motivo,
        queimados: queimaAgora ? [...estado.queimados, alvo] : estado.queimados,
        alturaSemDegrau: pedido.ceder === 'resolucao' ? (estado.alturaSemDegrau ?? teto) : null,
        limpoDesdeMs: agora,
        subiuEmMs: null,
        janelaDesdeMs: agora,
        decisoes: anotarDecisao(estado, { emMs: agora, de: estado.degrau, para, motivo }),
      }
    }
  }

  // Subir é a mesma escada na ordem inversa: o teto de bitrate primeiro, e o eixo caro só
  // depois que ele chegou onde a banda medida deixa. Quem assiste sofrendo cala as duas — a
  // única coisa pior que não subir é subir por cima de quem já não está dando conta.
  if (agora - limpoDesdeMs >= SUBIR_APOS_MS && !sofrendo) {
    const maior = subirOTeto(estado, pedido, alvoDoTeto(janela))
    if (maior !== null) {
      // Sem `subiuEmMs`: quem queima degrau é subida no eixo cedido. Uma descida logo depois de
      // o teto subir não é degrau que falhou — é o teto voltando, e ele volta sozinho.
      return { ...estado, tetoKbps: maior, limpoDesdeMs: agora, janelaDesdeMs: agora }
    }

    if (estado.degrau !== null) {
      const acima = degraus[degraus.indexOf(estado.degrau) - 1]
      const chegaAoPedido = acima === undefined || teto === null || acima >= teto
      const para = chegaAoPedido ? null : acima
      const destino = para ?? teto
      if (destino !== null && !estado.queimados.includes(destino)) {
        return {
          ...estado,
          degrau: para,
          motivo: para === null ? null : estado.motivo,
          alturaSemDegrau: para === null ? null : estado.alturaSemDegrau,
          limpoDesdeMs: agora,
          subiuEmMs: agora,
          janelaDesdeMs: agora,
          decisoes: anotarDecisao(estado, { emMs: agora, de: estado.degrau, para, motivo: null }),
        }
      }
    }
  }

  return limpoDesdeMs === estado.limpoDesdeMs ? estado : { ...estado, limpoDesdeMs }
}

/** Pedido ⊕ teto ⊕ degrau: o perfil que de fato vai para a captura e para o encoder. */
export function perfilEfetivo(pedido: PerfilDeQualidade, estado: EstadoDoGovernador): PerfilDeQualidade {
  const comTeto = estado.tetoKbps === null ? pedido : { ...pedido, tetoKbps: estado.tetoKbps }
  if (estado.degrau === null) return comTeto
  if (pedido.ceder === 'quadros') return { ...comTeto, fps: estado.degrau }
  const resolucao = resolucaoDaAltura(estado.degrau)
  return resolucao === null ? comTeto : { ...comTeto, resolucao }
}

export const NOME_DO_MOTIVO: Record<MotivoDoGovernador, string> = { cpu: 'CPU', banda: 'banda' }

/** `60 → 30 fps · CPU`, como a pessoa lê; `null` sem degrau em vigor. */
export function descreverDegrau(
  pedido: PerfilDeQualidade,
  estado: EstadoDoGovernador,
): { transicao: string; degrau: string; motivo: string } | null {
  if (estado.degrau === null || estado.motivo === null) return null
  const motivo = NOME_DO_MOTIVO[estado.motivo]
  if (pedido.ceder === 'quadros') {
    return { transicao: `${pedido.fps} → ${estado.degrau} fps`, degrau: String(estado.degrau), motivo }
  }
  const degrau = `${estado.degrau}p`
  return { transicao: `${pedido.resolucao} → ${degrau}`, degrau, motivo }
}
