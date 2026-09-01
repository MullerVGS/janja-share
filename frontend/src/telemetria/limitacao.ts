import type { AmostraDoEmissor, Limitacao } from './amostra'

/**
 * O que está limitando o encoder, deduzido de sinais que existem em qualquer navegador.
 *
 * Existe porque `qualityLimitationReason` é do Chrome: o Firefox não implementa, e sem ele o
 * governador nunca via limitação nenhuma — não descia degrau, não procurava teto, e dizia
 * "subindo" a transmissão inteira. Onde o navegador informa, a medida vale; aqui nasce só o que
 * falta.
 *
 * Duas razões bastam, e são as mesmas que um humano usa para julgar de fora:
 *
 *  - **aproveitamento** — quanto do bitrate autorizado o encoder de fato usou;
 *  - **acompanhamento** — quantos dos quadros que a fonte entregou ele conseguiu codificar.
 *
 * Entrega baixa com os quadros acompanhando é tela parada, não encoder cansado — e é o falso
 * positivo que mais importa evitar, porque condenaria um codec inocente numa Sala em que
 * ninguém está mexendo na tela.
 */

/** Abaixo disto o encoder está deixando na mesa o que lhe foi autorizado. */
export const APROVEITAMENTO_BAIXO = 0.5
/** Abaixo disto o encoder está ficando para trás da fonte. */
export const ACOMPANHAMENTO_BAIXO = 0.7
/**
 * Perda em % a partir da qual a rede é a explicação. Espelha o valor de `PERDA_QUE_SOFRE` do
 * governador sem importá-lo: lá é perda **relatada por quem assiste**, aqui é a que o RTCP de
 * quem recebe devolve ao emissor. Mesmo número, medidas diferentes — e importar criaria ciclo
 * entre telemetria e sala.
 */
export const PERDA_DA_REDE = 3

/** O mínimo do perfil que a inferência usa. `PerfilDeQualidade` satisfaz estruturalmente. */
export interface PedidoDoEncoder {
  tetoKbps: number
  fps: number
}

/**
 * O denominador é sempre o teto do perfil efetivo, nunca `alvoKbps`.
 *
 * Usar o `targetBitrate` inverteria o sinal: um navegador que baixou o próprio alvo para 700
 * kbps e entrega 700 daria aproveitamento 1,0 — o encoder pareceria saudável exatamente no caso
 * que queremos pegar. O alvo caindo é o sintoma, não a régua.
 */
function aproveitamentoDe(amostra: AmostraDoEmissor, pedido: PedidoDoEncoder): number | null {
  if (amostra.kbps === null || pedido.tetoKbps <= 0) return null
  return amostra.kbps / pedido.tetoKbps
}

/**
 * `estimado` marca a medida fraca: sem `framesPerSecond` no `media-source` não há como saber o
 * que a fonte entregou, e comparar com o fps *pedido* faz tela parada parecer encoder cansado.
 * Quem consome exige mais evidência nesse modo.
 */
function acompanhamentoDe(
  amostra: AmostraDoEmissor,
  pedido: PedidoDoEncoder,
): { valor: number; estimado: boolean } | null {
  if (amostra.fpsCodificado === null) return null
  if (amostra.fpsCaptura !== null && amostra.fpsCaptura > 0) {
    return { valor: amostra.fpsCodificado / amostra.fpsCaptura, estimado: false }
  }
  if (pedido.fps > 0) return { valor: amostra.fpsCodificado / pedido.fps, estimado: true }
  return null
}

export function inferirLimitacao(amostra: AmostraDoEmissor, pedido: PedidoDoEncoder): Limitacao | null {
  // Pausado pelo dynacast não descreve encoder nenhum.
  if (!amostra.ativo) return null

  // A rede é julgada primeiro e sozinha: um encoder que usa todo o teto autorizado enquanto a
  // rede perde pacote é banda — teto acima do que o link entrega. Exigir aproveitamento baixo
  // para acusar banda deixaria justamente esse caso passar por saudável.
  if ((amostra.perda ?? 0) > PERDA_DA_REDE) return 'banda'

  const aproveitamento = aproveitamentoDe(amostra, pedido)
  if (aproveitamento === null || aproveitamento >= APROVEITAMENTO_BAIXO) return null

  const acompanhamento = acompanhamentoDe(amostra, pedido)
  if (acompanhamento === null || acompanhamento.valor >= ACOMPANHAMENTO_BAIXO) return null
  if (acompanhamento.estimado && aproveitamento >= APROVEITAMENTO_BAIXO / 2) return null

  return 'cpu'
}
