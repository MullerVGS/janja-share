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

  it('delta 0 (rolagem horizontal, ou inércia entregando deltaY 0) não muda nada', () => {
    // Trackpad com rolagem de dois dedos manda WheelEvent.deltaY === 0 em boa parte dos
    // eventos; se `delta < 0` e "o resto afasta" fossem os dois únicos ramos, uma sequência
    // desses eventos empurraria a escala até o piso sem ninguém ter pedido zoom nenhum.
    const partida: Zoom = { escala: 1.5, x: 10, y: -5 }
    const resultado = aplicarGesto(partida, { tipo: 'roda', delta: 0, cursor: { x: 400, y: 225 } }, QUADRO_16X9)
    expect(resultado).toEqual(partida)
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

  it('o ponto sob o cursor não se move, mesmo quando os dois eixos já passam do quadro', () => {
    // Cenário do revisor: partindo de {escala:2, x:100, y:-50} com o cursor em (600,350), a
    // imagem já excede o quadro nos dois eixos (dw=1600, dh=900 contra 800×450). Isso importa
    // porque QUADRO_16X9 tem a mesma proporção da imagem (1920×1080): com a partida em
    // ZOOM_INICIAL e o cursor em (0,0) ou no centro, u=v=0 ou 0,5 e o termo de escala some da
    // conta — uma implementação que ancorasse no centro do quadro (errada) passaria igual.
    // Aqui não: só ancorar de fato no cursor bate com os números.
    const partida: Zoom = { escala: 2, x: 100, y: -50 }
    const cursor = { x: 600, y: 350 }

    const encaixe = Math.min(QUADRO_16X9.quadro.largura / QUADRO_16X9.imagem.largura, QUADRO_16X9.quadro.altura / QUADRO_16X9.imagem.altura)
    const antesLargura = QUADRO_16X9.imagem.largura * encaixe * partida.escala
    const antesAltura = QUADRO_16X9.imagem.altura * encaixe * partida.escala
    const topoAntesX = (QUADRO_16X9.quadro.largura - antesLargura) / 2 + partida.x
    const topoAntesY = (QUADRO_16X9.quadro.altura - antesAltura) / 2 + partida.y
    // A fração (0..1) da imagem que estava sob o cursor antes do gesto.
    const u = (cursor.x - topoAntesX) / antesLargura
    const v = (cursor.y - topoAntesY) / antesAltura

    const resultado = aplicarGesto(partida, { tipo: 'roda', delta: -1, cursor }, QUADRO_16X9)

    // Números exatos, conferidos na mão pelo revisor (toBeCloseTo por causa de ponto flutuante,
    // não porque o valor esperado seja aproximado).
    expect(resultado.escala).toBeCloseTo(2.2, 5)
    expect(resultado.x).toBeCloseTo(90, 5)
    expect(resultado.y).toBeCloseTo(-67.5, 5)

    // E a propriedade em si: a mesma fração da imagem, na escala nova, cai de volta no cursor.
    const depoisLargura = QUADRO_16X9.imagem.largura * encaixe * resultado.escala
    const depoisAltura = QUADRO_16X9.imagem.altura * encaixe * resultado.escala
    const topoDepoisX = (QUADRO_16X9.quadro.largura - depoisLargura) / 2 + resultado.x
    const topoDepoisY = (QUADRO_16X9.quadro.altura - depoisAltura) / 2 + resultado.y
    expect(topoDepoisX + u * depoisLargura).toBeCloseTo(cursor.x, 5)
    expect(topoDepoisY + v * depoisAltura).toBeCloseTo(cursor.y, 5)
  })

  it('depois de afastar, o deslocamento é preso ao novo limite (menor que o de antes)', () => {
    // Começa exatamente no limite positivo de escala 3 (800/450 de deslocamento, ver o teste
    // de "deslocamento preso às bordas"). Afastar reduz a escala e, com ela, o limite — sem um
    // re-clamp depois da ancoragem, o deslocamento ficaria "vazando" além da nova borda.
    const partida: Zoom = { escala: 3, x: 800, y: 450 }
    const resultado = aplicarGesto(partida, { tipo: 'roda', delta: 1, cursor: { x: 400, y: 225 } }, QUADRO_16X9)

    const encaixe = Math.min(800 / 1920, 450 / 1080)
    const dw = 1920 * encaixe * resultado.escala
    const dh = 1080 * encaixe * resultado.escala
    const limiteX = (dw - 800) / 2
    const limiteY = (dh - 450) / 2

    expect(resultado.escala).toBeCloseTo(3 / 1.1, 5)
    // Sem o re-clamp, x ficaria por volta de 727 e y por volta de 409 — os dois acima do novo
    // limite calculado aqui.
    expect(resultado.x).toBeCloseTo(limiteX, 5)
    expect(resultado.y).toBeCloseTo(limiteY, 5)
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
    // 800×450 num quadro 1200×900: encaixe = min(1200/800, 900/450) = min(1.5, 2) = 1.5;
    // escala = 1/1.5 = 0.6666... — longe dos dois saturadores (0,5 e 5), então o valor só
    // pode vir de ter rodado esse cálculo, não de um clamp escondendo o ramo errado (como
    // aconteceria com uma fixture cujo 1/encaixe caísse bem em cima de 0,5).
    const medidas: Medidas = { quadro: { largura: 1200, altura: 900 }, imagem: { largura: 800, altura: 450 } }
    const resultado = aplicarGesto(ZOOM_INICIAL, { tipo: 'umPorUm' }, medidas)
    expect(resultado.escala).toBeCloseTo(2 / 3, 5)
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

describe('aplicarGesto: quadro sem medida ainda (0×0)', () => {
  it('quadro 0×0 (antes do primeiro layout) também devolve o zoom intacto — sem isso, 1:1 salta pro teto 5', () => {
    const medidas: Medidas = { quadro: { largura: 0, altura: 0 }, imagem: { largura: 1920, altura: 1080 } }
    const zoom: Zoom = { escala: 1.5, x: 3, y: -2 }
    expect(aplicarGesto(zoom, { tipo: 'umPorUm' }, medidas)).toEqual(zoom)
  })
})
