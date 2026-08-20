/** Escalas puras dos gráficos da telemetria: domínio → pixels, sem DOM. */

export interface Dominio {
  minimo: number
  maximo: number
}

export type Serie = readonly (number | null)[]

/**
 * Posição x de cada uma das `quantidade` amostras, encostadas na direita de `largura`: o
 * gráfico é uma janela de `total` slots e a amostra mais nova está sempre na borda direita,
 * então um histórico curto deixa a esquerda vazia em vez de esticar.
 */
export function posicoesX(quantidade: number, total: number, largura: number): number[] {
  const passo = largura / Math.max(1, total - 1)
  const primeiro = total - quantidade
  return Array.from({ length: quantidade }, (_, indice) => Math.round((primeiro + indice) * passo * 100) / 100)
}

/** O menor entre 1, 2, 5 × 10ⁿ que cobre o valor — é o teto de eixo que se lê. */
export function tetoRedondo(valor: number): number {
  if (valor <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(valor))
  for (const multiplo of [1, 2, 5, 10]) {
    if (multiplo * potencia >= valor) return multiplo * potencia
  }
  return 10 * potencia
}

/** Do zero ao teto redondo acima de tudo; `piso` é um teto mínimo que vale tal qual (60 fps fica 60). */
export function dominioY(series: Serie[], referencias: number[], piso = 0): Dominio {
  let maior = 0
  for (const serie of series) for (const valor of serie) if (valor !== null && valor > maior) maior = valor
  for (const valor of referencias) if (valor > maior) maior = valor
  if (maior === 0) return { minimo: 0, maximo: Math.max(1, piso) }
  return { minimo: 0, maximo: maior <= piso ? piso : tetoRedondo(maior) }
}

export function yDe(valor: number, dominio: Dominio, altura: number): number {
  const fracao = (valor - dominio.minimo) / (dominio.maximo - dominio.minimo || 1)
  return Math.round((altura - fracao * altura) * 100) / 100
}

/**
 * O `d` de um `<path>`: uma linha por trecho contínuo, quebrada onde a série tem `null` — uma
 * amostra perdida vira buraco, não uma reta inventada entre vizinhas. Em `degraus`, cada valor
 * vale até a amostra seguinte (resolução não interpola).
 */
export function caminho(serie: Serie, xs: number[], dominio: Dominio, altura: number, degraus = false): string {
  let d = ''
  let aberto = false
  let yAnterior: number | null = null
  serie.forEach((valor, indice) => {
    const x = xs[indice]
    if (valor === null || x === undefined) {
      aberto = false
      yAnterior = null
      return
    }
    const y = yDe(valor, dominio, altura)
    if (!aberto) {
      d += `M${x} ${y}`
      aberto = true
    } else {
      if (degraus && yAnterior !== null) d += `L${x} ${yAnterior}`
      d += `L${x} ${y}`
    }
    yAnterior = y
  })
  return d
}

export interface Faixa<M> {
  inicio: number
  fim: number
  motivo: M
}

/** Trechos contíguos com o mesmo motivo, em índices de amostra (inclusivos). */
export function faixas<M>(motivos: readonly (M | null)[]): Faixa<M>[] {
  const resultado: Faixa<M>[] = []
  motivos.forEach((motivo, indice) => {
    if (motivo === null) return
    const anterior = resultado[resultado.length - 1]
    if (anterior && anterior.motivo === motivo && anterior.fim === indice - 1) anterior.fim = indice
    else resultado.push({ inicio: indice, fim: indice, motivo })
  })
  return resultado
}

export function marcasY(dominio: Dominio): number[] {
  return [dominio.maximo / 2, dominio.maximo]
}
