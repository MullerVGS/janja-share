import { describe, expect, it } from 'vitest'
import { aplicarGesto, ZOOM_INICIAL, type Medidas, type Zoom } from '../src/sala/zoom'

const QUADRO_16X9: Medidas = { quadro: { largura: 800, altura: 450 }, imagem: { largura: 1920, altura: 1080 } }

describe('aplicarGesto: roda', () => {
  it('delta negativo aproxima com passo 1,1; delta positivo afasta', () => {
    const aproximado = aplicarGesto(ZOOM_INICIAL, { tipo: 'roda', delta: -1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    expect(aproximado.escala).toBeCloseTo(1.1, 5)

    const afastado = aplicarGesto(aproximado, { tipo: 'roda', delta: 1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    expect(afastado.escala).toBeCloseTo(1, 5)
  })

  it('satura em 5 depois de aproximar muitas vezes, sem lançar', () => {
    let zoom: Zoom = ZOOM_INICIAL
    for (let i = 0; i < 50; i += 1) {
      zoom = aplicarGesto(zoom, { tipo: 'roda', delta: -1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    }
    expect(zoom.escala).toBeCloseTo(5, 5)
  })

  it('satura em 0,5 depois de afastar muitas vezes, sem lançar', () => {
    let zoom: Zoom = ZOOM_INICIAL
    for (let i = 0; i < 50; i += 1) {
      zoom = aplicarGesto(zoom, { tipo: 'roda', delta: 1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    }
    expect(zoom.escala).toBeCloseTo(0.5, 5)
  })

  it('o ponto sob o cursor não se move', () => {
    // Cursor fixo no canto superior esquerdo do quadro (0,0), que é onde a imagem também
    // começa em ZOOM_INICIAL (encaixada, sem deslocamento) — ancorar ali não deve mexer no
    // canto, mesmo depois de várias rodadas de zoom.
    let zoom: Zoom = ZOOM_INICIAL
    for (let i = 0; i < 5; i += 1) {
      zoom = aplicarGesto(zoom, { tipo: 'roda', delta: -1, cursor: { x: 0, y: 0 } }, QUADRO_16X9)
    }

    // encaixe = min(800/1920, 450/1080) = 0.41666...; topo da imagem em x = (800 - dw)/2 + x.
    const encaixe = Math.min(800 / 1920, 450 / 1080)
    const dw = 1920 * encaixe * zoom.escala
    const dh = 1080 * encaixe * zoom.escala
    const topoX = (800 - dw) / 2 + zoom.x
    const topoY = (450 - dh) / 2 + zoom.y
    expect(topoX).toBeCloseTo(0, 5)
    expect(topoY).toBeCloseTo(0, 5)
  })
})

describe('aplicarGesto: arraste', () => {
  it('soma dx/dy ao deslocamento quando a imagem é maior que o quadro', () => {
    const aproximado = aplicarGesto(ZOOM_INICIAL, { tipo: 'roda', delta: -1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    const arrastado = aplicarGesto(aproximado, { tipo: 'arraste', dx: 5, dy: -3 }, QUADRO_16X9)

    expect(arrastado.x).toBeCloseTo(aproximado.x + 5, 5)
    expect(arrastado.y).toBeCloseTo(aproximado.y - 3, 5)
  })

  it('deslocamento preso às bordas nos dois eixos — arraste enorme não passa do limite', () => {
    const aproximado = aplicarGesto(ZOOM_INICIAL, { tipo: 'roda', delta: -1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    const arrastado = aplicarGesto(aproximado, { tipo: 'arraste', dx: 100_000, dy: 100_000 }, QUADRO_16X9)

    const encaixe = Math.min(800 / 1920, 450 / 1080)
    const dw = 1920 * encaixe * arrastado.escala
    const dh = 1080 * encaixe * arrastado.escala
    const limiteX = (dw - 800) / 2
    const limiteY = (dh - 450) / 2

    expect(arrastado.x).toBeCloseTo(limiteX, 5)
    expect(arrastado.y).toBeCloseTo(limiteY, 5)
  })

  it('eixo menor que o quadro fica centrado (deslocamento 0), enquanto o outro eixo é preso ao limite', () => {
    // Imagem quadrada (1000×1000) num quadro 16:9 (800×450): encaixe = min(0.8, 0.45) = 0.45 —
    // a altura é o eixo que limita. Em escala 1,5, a imagem mede 675×675: cabe na largura do
    // quadro (675 < 800, eixo x sobra e fica centrado) mas passa da altura (675 > 450, eixo y
    // tem o que arrastar, preso ao limite (675-450)/2 = 112,5).
    const medidas: Medidas = { quadro: { largura: 800, altura: 450 }, imagem: { largura: 1000, altura: 1000 } }
    const partida: Zoom = { escala: 1.5, x: 0, y: 0 }
    const arrastado = aplicarGesto(partida, { tipo: 'arraste', dx: 999, dy: 999 }, medidas)

    expect(arrastado.x).toBe(0)
    expect(arrastado.y).toBeCloseTo(112.5, 5)
  })
})

describe('aplicarGesto: caber', () => {
  it('volta ao zoom inicial', () => {
    const zoom: Zoom = { escala: 3, x: 40, y: -20 }
    expect(aplicarGesto(zoom, { tipo: 'caber' }, QUADRO_16X9)).toEqual(ZOOM_INICIAL)
  })
})

describe('aplicarGesto: umPorUm', () => {
  it('imagem maior que o quadro: escala = 1/encaixe, deslocamento zerado', () => {
    // encaixe = min(800/1920, 450/1080) = 0.41666...; escala = 1/encaixe = 2.4
    const resultado = aplicarGesto(ZOOM_INICIAL, { tipo: 'umPorUm' }, QUADRO_16X9)
    expect(resultado.escala).toBeCloseTo(2.4, 5)
    expect(resultado.x).toBe(0)
    expect(resultado.y).toBe(0)
  })

  it('imagem menor que o quadro: escala cai abaixo de 1 (o encaixe já a tinha ampliado)', () => {
    const medidas: Medidas = { quadro: { largura: 1280, altura: 720 }, imagem: { largura: 640, altura: 360 } }
    // encaixe = min(1280/640, 720/360) = 2; escala = 1/2 = 0.5
    const resultado = aplicarGesto(ZOOM_INICIAL, { tipo: 'umPorUm' }, medidas)
    expect(resultado.escala).toBeCloseTo(0.5, 5)
  })
})

describe('aplicarGesto: imagem sem metadados (0×0)', () => {
  const SEM_METADADOS: Medidas = { quadro: { largura: 800, altura: 450 }, imagem: { largura: 0, altura: 0 } }

  it('roda devolve o zoom intacto, sem NaN', () => {
    const resultado = aplicarGesto(ZOOM_INICIAL, { tipo: 'roda', delta: -1, cursor: { x: 10, y: 10 } }, SEM_METADADOS)
    expect(resultado).toEqual(ZOOM_INICIAL)
  })

  it('arraste devolve o zoom intacto, sem NaN', () => {
    const zoom: Zoom = { escala: 2, x: 5, y: 5 }
    const resultado = aplicarGesto(zoom, { tipo: 'arraste', dx: 10, dy: 10 }, SEM_METADADOS)
    expect(resultado).toEqual(zoom)
  })

  it('umPorUm devolve o zoom intacto, sem NaN', () => {
    const zoom: Zoom = { escala: 2, x: 5, y: 5 }
    const resultado = aplicarGesto(zoom, { tipo: 'umPorUm' }, SEM_METADADOS)
    expect(resultado).toEqual(zoom)
  })
})
