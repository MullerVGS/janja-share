/**
 * O cão de guarda da recepção: uma tela assinada que nunca chega a entregar um byte sequer.
 *
 * O caso conhecido é entrar depois da live começada e ficar com o quadro preto até o
 * transmissor trocar de codec — republicar cria faixa nova, e faixa nova nasce chegando.
 * Reassinar é o mesmo remédio sem depender de quem transmite: força a assinatura a se
 * refazer, com um quadro-chave novo.
 *
 * O vigia só olha para telas que **nunca** entregaram nada desde que foram assinadas. Assim
 * que uma amostra trouxer bytes, ele para de olhar para aquela tela — para sempre. É o que
 * deixa em paz o vídeo pausado, o documento parado, a pessoa que só não está mexendo em nada:
 * essas telas já entregaram algo antes, então zerar depois é parada de verdade, não o bug.
 *
 * Esse é também o limite da regra: um keyframe perdido depois de a tela já estar chegando
 * não é coberto. O primeiro `kbps > 0` já encerrou a vigilância para sempre, e um soluço
 * isolado numa tela que já provou que funciona nunca chega a acender o alarme.
 *
 * Nesta fase inicial — e só nela — `kbps: null` conta como "nada chegou", não como "sem
 * informação". Se o relatório do navegador nunca chegar a ter estatística nenhuma para a
 * assinatura, `null` É o sintoma do bug original; tratar `null` como inofensivo deixaria o
 * vigia dormindo para sempre exatamente no caso que ele existe para pegar.
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
  /** Desde quando não chega nada; `null` enquanto o relógio ainda não começou a contar. */
  paradaDesdeMs: number | null
  tentativas: number
  ultimaTentativaEmMs: number | null
}

/** Uma tela recém-assinada: ainda não se sabe se ela entrega, e o vigia está de olho nela. */
export const VIGIA_NOVO: Vigia = { estado: 'parada', paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }

/** A tela confirmou que entrega bytes — o vigia para de olhar para ela, para sempre. */
const VIGIA_SAUDAVEL: Vigia = { estado: 'ok', paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }

/** Só a leitura de uma amostra interessa aqui — o resto do relatório não decide nada. */
export interface LeituraDaRecepcao {
  emMs: number
  kbps: number | null
}

/**
 * A cadência real do coletor: uma amostra por segundo. Uma leitura de 0 kbps no instante T é a
 * taxa medida *durante* o segundo que termina em T, não que começa nele — nada chegou nesse
 * intervalo. A parada começou em T − 1000, e é de lá que os 5 s de espera contam; sem este
 * desconto a primeira amostra zerada só fecharia a janela na sexta amostra, não na quinta.
 */
const INTERVALO_DA_AMOSTRA_MS = 1000

export function avaliarRecepcao(vigia: Vigia, leitura: LeituraDaRecepcao, agora: number): { vigia: Vigia; acao: Acao } {
  // Confirmada: a tela já provou que entrega. Isto vale para sempre, mesmo que ela zere de
  // novo depois — zerar depois de já ter entregado é parada legítima, não o bug.
  if (vigia.estado === 'ok') return { vigia, acao: 'nada' }

  // Uma amostra com bytes encerra a vigilância, venha ela logo de cara ou no meio de um ciclo
  // de tentativas — inclusive resolve o caso feliz: reassinar força o quadro-chave que faltava.
  if (leitura.kbps !== null && leitura.kbps > 0) return { vigia: VIGIA_SAUDAVEL, acao: 'nada' }

  if (vigia.estado === 'desistiu') return { vigia, acao: 'nada' }

  // Daqui em diante, kbps é 0 ou `null` — as duas leituras significam a mesma coisa nesta fase
  // (nunca chegou nada desde a assinatura), pelo motivo explicado no topo do arquivo.
  const paradaDesdeMs = vigia.paradaDesdeMs ?? agora - INTERVALO_DA_AMOSTRA_MS
  const base: Vigia = { ...vigia, paradaDesdeMs }

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
