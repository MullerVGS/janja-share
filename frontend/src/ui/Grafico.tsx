import { useState, type PointerEvent } from 'react'
import { TETO_DO_HISTORICO } from '../telemetria/historico'
import { caminho, dominioY, marcasY, posicoesX, yDe, type Faixa, type Serie } from './grafico'
import estilos from './Grafico.module.css'

export type CorDaSerie = 'acao' | 'apoio'

export interface SerieDoGrafico {
  nome: string
  valores: Serie
  cor: CorDaSerie
  /** A série que o gráfico é sobre: ganha o valor atual no cabeçalho. */
  destaque?: boolean
}

export interface Referencia {
  nome: string
  valor: number
  /**
   * Não manda no eixo: a marca cola no topo e o número de verdade fica na legenda. É para o
   * teto do governador, que sobe sozinho e é dez vezes o tráfego real de uma tela parada —
   * dentro do domínio ele achataria a série no chão e reescalaria o eixo a cada degrau, o que
   * faz a linha de bitrate *encolher* na tela justamente enquanto o governador acerta.
   */
  foraDoEixo?: boolean
}

/** Uma amostra em que algo aconteceu — o governador agiu — com a frase que o ponteiro revela. */
export interface Marca {
  indice: number
  rotulo: string
}

interface Props {
  titulo: string
  series: SerieDoGrafico[]
  /** Linhas horizontais tracejadas — alvo, teto. Entram no domínio. */
  referencias?: Referencia[]
  /** Trechos do fundo pintados por motivo (índices de amostra). */
  faixas?: Faixa<string>[]
  /** Teto mínimo do eixo; o alvo pedido, normalmente. */
  piso?: number
  marcas?: Marca[]
  degraus?: boolean
  formatar(valor: number): string
}

const LARGURA = 320
const ALTURA = 96

/**
 * Gráfico de linhas dos últimos 2 minutos, em SVG próprio.
 *
 * A geometria vive num `viewBox` fixo esticado em largura (`preserveAspectRatio="none"`), com
 * traços que não escalam; tudo que é texto fica em HTML por cima, para não esticar junto.
 * Passar o ponteiro lê todas as séries naquele instante — valor primeiro, nome depois.
 */
export function Grafico({ titulo, series, referencias = [], faixas = [], piso = 0, marcas = [], degraus = false, formatar }: Props) {
  const [sobPonteiro, setSobPonteiro] = useState<number | null>(null)

  const quantidade = Math.max(0, ...series.map((serie) => serie.valores.length))
  const xs = posicoesX(quantidade, TETO_DO_HISTORICO, LARGURA)
  const dominio = dominioY(
    series.map((serie) => serie.valores),
    referencias.filter((referencia) => !referencia.foraDoEixo).map((referencia) => referencia.valor),
    piso,
  )
  const destaque = series.find((serie) => serie.destaque) ?? series[0]
  const atual = destaque ? ultimoValor(destaque.valores) : null
  const indice = sobPonteiro !== null && sobPonteiro < quantidade ? sobPonteiro : null

  function apontar(evento: PointerEvent<SVGSVGElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect()
    if (caixa.width === 0) return
    const slot = Math.round(((evento.clientX - caixa.left) / caixa.width) * (TETO_DO_HISTORICO - 1))
    const candidato = slot - (TETO_DO_HISTORICO - quantidade)
    setSobPonteiro(candidato >= 0 && candidato < quantidade ? candidato : null)
  }

  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.cabecalho}>
        <span className={estilos.titulo}>{titulo}</span>
        {indice === null ? (
          <span className={estilos.atual}>{atual === null ? '—' : formatar(atual)}</span>
        ) : (
          <span className={estilos.leitura}>
            {series.map((serie) => {
              const valor = serie.valores[indice] ?? null
              return (
                <span key={serie.nome} className={estilos.itemDaLeitura}>
                  <i className={`${estilos.chave} ${estilos[serie.cor]}`} aria-hidden="true" />
                  <b>{valor === null ? '—' : formatar(valor)}</b> {serie.nome}
                </span>
              )
            })}
          </span>
        )}
      </figcaption>

      <div className={estilos.area}>
        <svg
          className={estilos.tela}
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={titulo}
          onPointerMove={apontar}
          onPointerLeave={() => setSobPonteiro(null)}
        >
          {faixas.map((faixa) => {
            const inicio = xs[faixa.inicio]
            const fim = xs[faixa.fim]
            if (inicio === undefined || fim === undefined) return null
            const meio = LARGURA / (TETO_DO_HISTORICO - 1) / 2
            return (
              <rect
                key={`${faixa.inicio}-${faixa.motivo}`}
                className={estilos.faixa}
                data-motivo={faixa.motivo}
                x={Math.max(0, inicio - meio)}
                y={0}
                width={Math.min(LARGURA, fim + meio) - Math.max(0, inicio - meio)}
                height={ALTURA}
              />
            )
          })}

          {marcasY(dominio).map((marca) => (
            <line
              key={marca}
              className={estilos.grade}
              x1={0}
              x2={LARGURA}
              y1={yDe(marca, dominio, ALTURA)}
              y2={yDe(marca, dominio, ALTURA)}
            />
          ))}

          {referencias.map((referencia) => {
            // Só uma referência `foraDoEixo` pode passar do topo — as outras entraram no domínio.
            const grampeada = referencia.valor > dominio.maximo
            const y = yDe(grampeada ? dominio.maximo : referencia.valor, dominio, ALTURA)
            return (
              <line
                key={referencia.nome}
                className={estilos.referencia}
                data-grampeada={grampeada || undefined}
                x1={0}
                x2={LARGURA}
                y1={y}
                y2={y}
              />
            )
          })}

          {series.map((serie) => (
            <path
              key={serie.nome}
              className={`${estilos.linha} ${estilos[serie.cor]} ${serie.destaque ? estilos.destaque : ''}`}
              d={caminho(serie.valores, xs, dominio, ALTURA, degraus)}
            />
          ))}

          {marcas.map((marca) => {
            const x = xs[marca.indice]
            if (x === undefined) return null
            return (
              <line key={`${marca.indice}-${marca.rotulo}`} className={estilos.marca} data-marca x1={x} x2={x} y1={0} y2={ALTURA}>
                <title>{marca.rotulo}</title>
              </line>
            )
          })}

          {indice !== null && xs[indice] !== undefined && (
            <line className={estilos.mira} x1={xs[indice]} x2={xs[indice]} y1={0} y2={ALTURA} />
          )}
        </svg>

        <div className={estilos.eixoY} aria-hidden="true">
          {marcasY(dominio).map((marca) => (
            <span key={marca} style={{ top: `${(yDe(marca, dominio, ALTURA) / ALTURA) * 100}%` }}>
              {formatar(marca)}
            </span>
          ))}
        </div>
      </div>

      {(series.length > 1 || referencias.length > 0) && (
        <ul className={estilos.legenda}>
          {series.map((serie) => (
            <li key={serie.nome}>
              <i className={`${estilos.chave} ${estilos[serie.cor]}`} aria-hidden="true" />
              {serie.nome}
            </li>
          ))}
          {referencias.map((referencia) => (
            <li key={referencia.nome}>
              <i className={`${estilos.chave} ${estilos.chaveDeReferencia}`} aria-hidden="true" />
              {referencia.nome} {formatar(referencia.valor)}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

function ultimoValor(serie: Serie): number | null {
  for (let indice = serie.length - 1; indice >= 0; indice -= 1) {
    const valor = serie[indice]
    if (valor !== null && valor !== undefined) return valor
  }
  return null
}
