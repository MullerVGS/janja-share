/**
 * O cão de guarda da recepção: uma tela assinada que não entrega bytes.
 *
 * Ele tem duas fases, e o remédio das duas é o mesmo — reassinar, que força a assinatura a se
 * refazer com um quadro-chave novo, sem depender de quem transmite.
 *
 * **Nunca chegou** (`parada` → `retomando` → `desistiu`): a tela assinada que não entregou um
 * byte sequer. O caso conhecido é entrar depois da live começada e ficar com o quadro preto até
 * o transmissor trocar de codec. Nesta fase — e só nela — `kbps: null` conta como "nada
 * chegou": se o navegador nunca chegar a ter estatística da assinatura, `null` É o sintoma, e
 * tratá-lo como inofensivo deixaria o vigia dormindo exatamente no caso que ele existe para pegar.
 *
 * **Congelou** (`ok` → `congelada`): a tela que já entregou e parou de entregar por
 * `ESPERA_PARA_CONGELAR_MS` **enquanto o dono diz que está mandando** (o pulso, `relato.ts`).
 * Sem o pulso, silêncio não quer dizer nada: uma fonte sem quadro novo — o documento parado —
 * também não manda byte, e do lado de quem recebe isso é idêntico à assinatura travada (ADR
 * 0015). O vigia tenta reassinar em ciclos como na outra fase e, esgotadas as tentativas, fica
 * em `congelada` à espera do "Tentar de novo"; qualquer byte que chegue devolve a tela a `ok`.
 *
 * **Pausada** não é nenhuma das duas: quem compartilha parou de mandar de propósito (o
 * navegador pausou a captura, o LiveKit sinaliza como mudo). Leitura pausada zera o relógio e
 * não age — o quadro diz "pausada", não "parou de chegar". O dono calado (`donoEnviando:
 * false`) vale o mesmo para a fase do congelamento: a tela está parada, não travada.
 *
 * Puro sobre estado serializável: o relógio é o das amostras, e quem age é o coletor.
 */

export type EstadoDaRecepcao = 'ok' | 'parada' | 'retomando' | 'desistiu' | 'congelada'
export type Acao = 'nada' | 'reassinar'

export const ESPERA_ANTES_DE_RETOMAR_MS = 5000
export const ESPERA_ENTRE_TENTATIVAS_MS = 8000
export const TENTATIVAS_MAXIMAS = 3
/** Sem byte nenhum por este tempo, uma tela que já chegava conta como congelada. */
export const ESPERA_PARA_CONGELAR_MS = 6000

export interface Vigia {
  estado: EstadoDaRecepcao
  /** Desde quando não chega nada; `null` enquanto o relógio não está contando. */
  paradaDesdeMs: number | null
  tentativas: number
  ultimaTentativaEmMs: number | null
}

/** Uma tela recém-assinada: ainda não se sabe se ela entrega, e o vigia está de olho nela. */
export const VIGIA_NOVO: Vigia = { estado: 'parada', paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }

/** A tela entrega bytes — o vigia só volta a agir se ela congelar. */
const VIGIA_SAUDAVEL: Vigia = { estado: 'ok', paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }

/** Só a leitura de uma amostra interessa aqui — o resto do relatório não decide nada. */
export interface LeituraDaRecepcao {
  emMs: number
  kbps: number | null
  /** Quem compartilha pausou a tela (a publicação está muda): não chegar nada é o esperado. */
  pausada?: boolean
  /**
   * O pulso do dono: ele está mandando bytes. `false` é a tela parada (não chegar nada é o
   * esperado depois de já ter chegado); ausente conta como mandando.
   */
  donoEnviando?: boolean
}

/**
 * A cadência real do coletor: uma amostra por segundo. Uma leitura de 0 kbps no instante T é a
 * taxa medida *durante* o segundo que termina em T, não que começa nele — nada chegou nesse
 * intervalo. A parada começou em T − 1000, e é de lá que os 5 s de espera contam; sem este
 * desconto a primeira amostra zerada só fecharia a janela na sexta amostra, não na quinta.
 */
const INTERVALO_DA_AMOSTRA_MS = 1000

/** Hora de tentar de novo? Depois da espera inicial, uma vez a cada `ESPERA_ENTRE_TENTATIVAS_MS`. */
function vezDeTentar(vigia: Vigia, agora: number, espera: number): boolean {
  if (vigia.paradaDesdeMs === null || agora - vigia.paradaDesdeMs < espera) return false
  return vigia.ultimaTentativaEmMs === null || agora - vigia.ultimaTentativaEmMs >= ESPERA_ENTRE_TENTATIVAS_MS
}

function tentar(vigia: Vigia, estado: EstadoDaRecepcao, agora: number): { vigia: Vigia; acao: Acao } {
  return {
    vigia: { ...vigia, estado, tentativas: vigia.tentativas + 1, ultimaTentativaEmMs: agora },
    acao: 'reassinar',
  }
}

export function avaliarRecepcao(vigia: Vigia, leitura: LeituraDaRecepcao, agora: number): { vigia: Vigia; acao: Acao } {
  const chegou = leitura.kbps !== null && leitura.kbps > 0

  // A tela entrega: vale venha o byte logo de cara, no meio de um ciclo de tentativas ou
  // depois de congelar — reassinar força o quadro-chave que faltava.
  if (chegou) return { vigia: vigia.estado === 'ok' && vigia.paradaDesdeMs === null ? vigia : VIGIA_SAUDAVEL, acao: 'nada' }

  // Pausada de propósito: o relógio não conta. Quem congelou e foi pausada passa a ser só pausada.
  if (leitura.pausada) {
    const estado = vigia.estado === 'congelada' ? 'ok' : vigia.estado
    return { vigia: { ...vigia, estado, paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }, acao: 'nada' }
  }

  // A tela que já chegou e cujo dono não está mandando nada está parada, não congelada.
  const jaChegou = vigia.estado === 'ok' || vigia.estado === 'congelada'
  if (jaChegou && leitura.donoEnviando === false) {
    return { vigia: { ...vigia, estado: 'ok', paradaDesdeMs: null, tentativas: 0, ultimaTentativaEmMs: null }, acao: 'nada' }
  }

  // Daqui em diante, kbps é 0 ou `null`. A parada começou um intervalo antes desta leitura.
  const base: Vigia = { ...vigia, paradaDesdeMs: vigia.paradaDesdeMs ?? agora - INTERVALO_DA_AMOSTRA_MS }

  if (jaChegou) {
    if (!vezDeTentar(base, agora, ESPERA_PARA_CONGELAR_MS)) return { vigia: base, acao: 'nada' }
    if (base.tentativas >= TENTATIVAS_MAXIMAS) return { vigia: { ...base, estado: 'congelada' }, acao: 'nada' }
    return tentar(base, 'congelada', agora)
  }

  if (vigia.estado === 'desistiu') return { vigia, acao: 'nada' }
  if (!vezDeTentar(base, agora, ESPERA_ANTES_DE_RETOMAR_MS)) return { vigia: base, acao: 'nada' }
  if (base.tentativas >= TENTATIVAS_MAXIMAS) return { vigia: { ...base, estado: 'desistiu' }, acao: 'nada' }
  return tentar(base, 'retomando', agora)
}

/**
 * O "Tentar de novo" de quem olha o quadro. A tela que nunca chegou volta ao começo da
 * vigilância; a congelada ganha tentativas novas e reassina já, sem esperar a vez.
 */
export function rearmarVigia(vigia: Vigia, agora: number): { vigia: Vigia; acao: Acao } {
  if (vigia.estado === 'congelada') return tentar({ ...vigia, tentativas: 0 }, 'congelada', agora)
  return { vigia: VIGIA_NOVO, acao: 'nada' }
}
