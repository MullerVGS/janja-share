/**
 * O zoom da transmissão: função pura `(estado, gesto) → estado`, sem tocar no DOM — as medidas
 * do quadro e da imagem chegam por argumento porque `getBoundingClientRect` devolve zeros no
 * jsdom, e é o que faz esta matemática testável fora do React.
 */
export interface Zoom {
  /** Multiplicadora sobre o encaixe: 1 é a tela inteira cabendo no quadro. */
  escala: number
  x: number
  y: number
}

export const ZOOM_INICIAL: Zoom = { escala: 1, x: 0, y: 0 }

export interface Medidas {
  quadro: { largura: number; altura: number }
  imagem: { largura: number; altura: number }
}

export type Gesto =
  | { tipo: 'roda'; delta: number; cursor: { x: number; y: number } }
  | { tipo: 'arraste'; dx: number; dy: number }
  | { tipo: 'caber' }
  | { tipo: 'umPorUm' }

const ESCALA_MINIMA = 0.5
const ESCALA_MAXIMA = 5
const PASSO_RODA = 1.1

function saturarEscala(escala: number): number {
  return Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, escala))
}

/**
 * O fator entre o pixel da imagem e o pixel do quadro quando ela está toda encaixada
 * (`escala: 1`). `null` quando a imagem ainda não tem metadados (`0×0`) — dividir por zero
 * aqui é real, não hipotético, e é o chamador que decide devolver o zoom intacto nesse caso.
 */
function encaixe(medidas: Medidas): number | null {
  const { imagem, quadro } = medidas
  if (imagem.largura <= 0 || imagem.altura <= 0) return null
  return Math.min(quadro.largura / imagem.largura, quadro.altura / imagem.altura)
}

/** O tamanho desenhado da imagem no quadro, em pixels do quadro, numa dada escala. */
function tamanhoDesenhado(medidas: Medidas, fator: number, escala: number) {
  return { largura: medidas.imagem.largura * fator * escala, altura: medidas.imagem.altura * fator * escala }
}

/** Preso ao intervalo que impede faixa vazia: sobrando espaço no eixo, ele fica centrado (0). */
function prenderEixo(deslocamento: number, tamanhoDaImagem: number, tamanhoDoQuadro: number): number {
  if (tamanhoDaImagem <= tamanhoDoQuadro) return 0
  const limite = (tamanhoDaImagem - tamanhoDoQuadro) / 2
  return Math.min(limite, Math.max(-limite, deslocamento))
}

function prenderNasBordas(zoom: Zoom, medidas: Medidas, fator: number): Zoom {
  const desenhado = tamanhoDesenhado(medidas, fator, zoom.escala)
  return {
    escala: zoom.escala,
    x: prenderEixo(zoom.x, desenhado.largura, medidas.quadro.largura),
    y: prenderEixo(zoom.y, desenhado.altura, medidas.quadro.altura),
  }
}

/**
 * Zoom pela roda, ancorado no cursor: o ponto da imagem que está sob `cursor` (coordenadas
 * relativas ao canto superior esquerdo do quadro) continua sob ele depois do gesto. A imagem é
 * desenhada centrada no quadro e depois deslocada por `(x, y)` — dá pra achar o canto superior
 * esquerdo dela antes e depois do zoom, e resolver o deslocamento que mantém o mesmo ponto fixo.
 */
function aplicarRoda(zoom: Zoom, gesto: Extract<Gesto, { tipo: 'roda' }>, medidas: Medidas, fator: number): Zoom {
  const escalaNova = saturarEscala(zoom.escala * (gesto.delta < 0 ? PASSO_RODA : 1 / PASSO_RODA))

  const antes = tamanhoDesenhado(medidas, fator, zoom.escala)
  const topoAntesX = (medidas.quadro.largura - antes.largura) / 2 + zoom.x
  const topoAntesY = (medidas.quadro.altura - antes.altura) / 2 + zoom.y
  const u = (gesto.cursor.x - topoAntesX) / antes.largura
  const v = (gesto.cursor.y - topoAntesY) / antes.altura

  const depois = tamanhoDesenhado(medidas, fator, escalaNova)
  const topoDepoisX = gesto.cursor.x - u * depois.largura
  const topoDepoisY = gesto.cursor.y - v * depois.altura

  const zoomAncorado: Zoom = {
    escala: escalaNova,
    x: topoDepoisX - (medidas.quadro.largura - depois.largura) / 2,
    y: topoDepoisY - (medidas.quadro.altura - depois.altura) / 2,
  }
  return prenderNasBordas(zoomAncorado, medidas, fator)
}

export function aplicarGesto(zoom: Zoom, gesto: Gesto, medidas: Medidas): Zoom {
  if (gesto.tipo === 'caber') return ZOOM_INICIAL

  const fator = encaixe(medidas)
  if (fator === null) return zoom // sem metadados da imagem ainda: nada a fazer, sem NaN

  switch (gesto.tipo) {
    case 'roda':
      return aplicarRoda(zoom, gesto, medidas, fator)
    case 'arraste':
      return prenderNasBordas({ ...zoom, x: zoom.x + gesto.dx, y: zoom.y + gesto.dy }, medidas, fator)
    case 'umPorUm':
      return { escala: saturarEscala(1 / fator), x: 0, y: 0 }
  }
}
