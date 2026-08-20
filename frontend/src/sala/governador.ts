import type { AmostraDoEmissor } from '../telemetria/amostra'
import { alturaDaResolucao, resolucaoDaAltura, RESOLUCOES, type PerfilDeQualidade } from './qualidade'

/**
 * O governador: transforma a adaptação contínua do Chrome em degraus estáveis.
 *
 * O encoder já cede sozinho quando a CPU ou a banda não dão conta — mas cede oscilando, e 40–60
 * fps serrilhados são piores de assistir que 30 cravados. O governador olha a janela recente e,
 * quando a limitação é persistente **e** o eixo escolhido já está cedendo, pede de uma vez o
 * patamar que cabe. Sobe de volta com cautela, um degrau a cada 30 s limpos, e aprende: um
 * degrau que falhou logo depois de subir fica queimado até a pessoa mexer nos controles.
 *
 * É uma função pura sobre estado serializável; o relógio é o das amostras (`emMs`), não o da
 * máquina. Quem alimenta é o hook, uma vez por amostra nova. O pedido da pessoa é o teto: o
 * governador só desce a partir dele e só volta até ele.
 */

export const JANELA = 5
export const MINIMO_LIMITADAS = 4
export const FOLGA = 0.9
export const SUBIR_APOS_MS = 30_000
export const QUEIMAR_SE_DESCER_EM_MS = 60_000
export const TETO_DE_DECISOES = 20

export const DEGRAUS_DE_FPS: readonly number[] = [60, 45, 30, 24, 15, 10, 5]
export const DEGRAUS_DE_ALTURA: readonly number[] = RESOLUCOES.flatMap((opcao) => (opcao.altura === null ? [] : [opcao.altura]))

export type MotivoDoGovernador = 'cpu' | 'banda'

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
  motivo: MotivoDoGovernador | null
  /** Degraus que falharam logo depois de uma subida; não se volta a eles até a pessoa mexer. */
  queimados: readonly number[]
  /**
   * A altura que a captura entregava antes do primeiro degrau de resolução. Com o degrau em
   * vigor a captura passa a entregar o degrau, e sem isto o governador não saberia até onde subir.
   */
  alturaSemDegrau: number | null
  /** Instante (relógio das amostras) da última limitação ou decisão: é de onde os 30 s contam. */
  limpoDesdeMs: number | null
  subiuEmMs: number | null
  /** Amostras até aqui já foram julgadas; a janela seguinte começa depois. */
  decidiuEmMs: number | null
  decisoes: readonly DecisaoDoGovernador[]
}

export const GOVERNADOR_PARADO: EstadoDoGovernador = {
  degrau: null,
  motivo: null,
  queimados: [],
  alturaSemDegrau: null,
  limpoDesdeMs: null,
  subiuEmMs: null,
  decidiuEmMs: null,
  decisoes: [],
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
): EstadoDoGovernador {
  const nova = historico[historico.length - 1]
  if (!nova) return estado
  const agora = nova.emMs

  // Pausado pelo dynacast não é limitação nem tempo limpo: a batida não conta para nada.
  if (!nova.ativo) return estado.limpoDesdeMs === agora ? estado : { ...estado, limpoDesdeMs: agora }

  const janela = historico.filter((amostra) => estado.decidiuEmMs === null || amostra.emMs > estado.decidiuEmMs).slice(-JANELA)
  const degraus = pedido.ceder === 'quadros' ? DEGRAUS_DE_FPS : DEGRAUS_DE_ALTURA
  const medidaDe = (amostra: AmostraDoEmissor) => (pedido.ceder === 'quadros' ? amostra.fpsCodificado : amostra.altura)
  const teto = tetoDoPedido(pedido, estado, janela)
  const alvo = estado.degrau ?? teto

  const limpoDesdeMs = motivoDe(nova) !== null ? agora : estado.limpoDesdeMs

  const limitadas = janela.filter((amostra) => motivoDe(amostra) !== null)
  if (janela.length >= JANELA && limitadas.length >= MINIMO_LIMITADAS && alvo !== null) {
    const medida = media(limitadas.map(medidaDe))
    if (medida !== null && medida < FOLGA * alvo) {
      const para = degraus.find((degrau) => degrau <= FOLGA * medida) ?? degraus[degraus.length - 1] ?? null
      const porBanda = limitadas.filter((amostra) => motivoDe(amostra) === 'banda').length
      const motivo: MotivoDoGovernador = porBanda * 2 > limitadas.length ? 'banda' : 'cpu'
      const queimaAgora = estado.subiuEmMs !== null && agora - estado.subiuEmMs < QUEIMAR_SE_DESCER_EM_MS
      return {
        ...estado,
        degrau: para,
        motivo,
        queimados: queimaAgora ? [...estado.queimados, alvo] : estado.queimados,
        alturaSemDegrau: pedido.ceder === 'resolucao' ? (estado.alturaSemDegrau ?? teto) : null,
        limpoDesdeMs: agora,
        decidiuEmMs: agora,
        decisoes: anotarDecisao(estado, { emMs: agora, de: estado.degrau, para, motivo }),
      }
    }
  }

  if (estado.degrau !== null && limpoDesdeMs !== null && agora - limpoDesdeMs >= SUBIR_APOS_MS) {
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
        decidiuEmMs: agora,
        decisoes: anotarDecisao(estado, { emMs: agora, de: estado.degrau, para, motivo: null }),
      }
    }
  }

  return limpoDesdeMs === estado.limpoDesdeMs ? estado : { ...estado, limpoDesdeMs }
}

/** Pedido ⊕ degrau: o perfil que de fato vai para a captura e para o encoder. */
export function perfilEfetivo(pedido: PerfilDeQualidade, estado: EstadoDoGovernador): PerfilDeQualidade {
  if (estado.degrau === null) return pedido
  if (pedido.ceder === 'quadros') return { ...pedido, fps: estado.degrau }
  const resolucao = resolucaoDaAltura(estado.degrau)
  return resolucao === null ? pedido : { ...pedido, resolucao }
}

const NOME_DO_MOTIVO: Record<MotivoDoGovernador, string> = { cpu: 'CPU', banda: 'banda' }

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
