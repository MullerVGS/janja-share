/**
 * O cão de guarda da recepção: uma tela publicada e assinada que não entrega byte nenhum.
 *
 * O caso conhecido é entrar depois da live começada e ficar com o quadro preto até o
 * transmissor trocar de codec — republicar cria faixa nova, e faixa nova nasce chegando.
 * Reassinar força quadro-chave e resolve o mesmo sintoma sem depender de quem transmite.
 *
 * Puro sobre estado serializável: o relógio é o das amostras, e quem age é o coletor.
 */

export type EstadoDaRecepcao = 'ok' | 'parada' | 'retomando' | 'desistiu'
export type Acao = 'nada' | 'reassinar'

export const ESPERA_ANTES_DE_RETOMAR_MS = 5000
export const ESPERA_ENTRE_TENTATIVAS_MS = 8000
export const TENTATIVAS_MAXIMAS = 3

export interface Vigia {
  estado: EstadoDaRecepcao
  /** Quando o bitrate zerou; `null` enquanto chega alguma coisa. */
  paradaDesdeMs: number | null
  tentativas: number
  ultimaTentativaEmMs: number | null
}

export const VIGIA_NOVO: Vigia = { estado: 'ok', paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }

/** Só a leitura de uma amostra interessa aqui — o resto do relatório não decide nada. */
export interface LeituraDaRecepcao {
  emMs: number
  kbps: number | null
}

/**
 * A cadência real do coletor: uma amostra por segundo. Não há como saber, dentro do segundo em
 * que o bitrate zerou, se ele caiu logo no início ou bem no fim — e supor o início é o que faz
 * a primeira amostra zerada já contar como o primeiro segundo parado, em vez de descartá-lo.
 * Sem este desconto a espera de 5 s só se completaria na sexta amostra, não na quinta.
 */
const INTERVALO_DA_AMOSTRA_MS = 1000

export function avaliarRecepcao(vigia: Vigia, leitura: LeituraDaRecepcao, agora: number): { vigia: Vigia; acao: Acao } {
  // `null` é a primeira leitura da publicação: não há taxa porque não há leitura anterior para
  // subtrair, e chamar isso de "parada" reassinaria toda tela no primeiro segundo de vida.
  if (leitura.kbps === null) return { vigia, acao: 'nada' }

  if (leitura.kbps > 0) return { vigia: VIGIA_NOVO, acao: 'nada' }

  const paradaDesdeMs = vigia.paradaDesdeMs ?? agora - INTERVALO_DA_AMOSTRA_MS
  const base: Vigia = { ...vigia, paradaDesdeMs, estado: vigia.estado === 'ok' ? 'parada' : vigia.estado }

  if (base.estado === 'desistiu') return { vigia: base, acao: 'nada' }
  if (agora - paradaDesdeMs < ESPERA_ANTES_DE_RETOMAR_MS) return { vigia: base, acao: 'nada' }
  if (base.ultimaTentativaEmMs !== null && agora - base.ultimaTentativaEmMs < ESPERA_ENTRE_TENTATIVAS_MS) {
    return { vigia: base, acao: 'nada' }
  }
  if (base.tentativas >= TENTATIVAS_MAXIMAS) return { vigia: { ...base, estado: 'desistiu' }, acao: 'nada' }

  return {
    vigia: { ...base, estado: 'retomando', tentativas: base.tentativas + 1, ultimaTentativaEmMs: agora },
    acao: 'reassinar',
  }
}
