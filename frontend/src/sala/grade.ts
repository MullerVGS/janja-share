/**
 * A grade da chamada: quantas colunas e de que tamanho, para N quadros 16:9 caberem na área
 * inteira com o maior quadro possível — todos do mesmo tamanho, centrados, como em toda chamada
 * de vídeo.
 */
export interface Arranjo {
  colunas: number
  largura: number
  altura: number
}

export const PROPORCAO_DO_QUADRO = 16 / 9

export function arranjoDaGrade(quantos: number, largura: number, altura: number, folga = 8): Arranjo {
  if (quantos <= 0 || largura <= 0 || altura <= 0) return { colunas: 1, largura: 0, altura: 0 }
  let melhor: Arranjo = { colunas: 1, largura: 0, altura: 0 }
  for (let colunas = 1; colunas <= quantos; colunas++) {
    const linhas = Math.ceil(quantos / colunas)
    const pelaLargura = (largura - folga * (colunas - 1)) / colunas
    const pelaAltura = ((altura - folga * (linhas - 1)) / linhas) * PROPORCAO_DO_QUADRO
    const larguraDoQuadro = Math.floor(Math.max(0, Math.min(pelaLargura, pelaAltura)))
    if (larguraDoQuadro > melhor.largura) {
      melhor = { colunas, largura: larguraDoQuadro, altura: Math.floor(larguraDoQuadro / PROPORCAO_DO_QUADRO) }
    }
  }
  return melhor
}
