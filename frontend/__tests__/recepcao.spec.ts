import { describe, expect, it } from 'vitest'
import {
  avaliarRecepcao, ESPERA_ANTES_DE_RETOMAR_MS, ESPERA_ENTRE_TENTATIVAS_MS, ESPERA_PARA_CONGELAR_MS,
  rearmarVigia, TENTATIVAS_MAXIMAS, VIGIA_NOVO, type Vigia,
} from '../src/sala/recepcao'

/** Alimenta o vigia como o coletor faz: uma amostra por segundo. */
function correr(vigia: Vigia, segundos: number, kbps: number | null, desde = 0, pausada = false) {
  let atual = vigia
  const acoes: string[] = []
  for (let i = 1; i <= segundos; i += 1) {
    const agora = desde + i * 1000
    const passo = avaliarRecepcao(atual, { emMs: agora, kbps, pausada }, agora)
    atual = passo.vigia
    acoes.push(passo.acao)
  }
  return { vigia: atual, acoes }
}

describe('recepção: a tela já confirmou que entrega', () => {
  it('bitrate positivo já na primeira amostra encerra a vigilância e nunca mais age', () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 20, 1200)
    expect(vigia.estado).toBe('ok')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })

  it('uma amostra positiva no meio de um ciclo de tentativas encerra a fase do "nunca chegou"', () => {
    const emCiclo = correr(VIGIA_NOVO, 13, 0)
    expect(emCiclo.acoes.filter((acao) => acao === 'reassinar')).toHaveLength(2) // já em pleno ciclo, sanity check

    const confirmou = correr(emCiclo.vigia, 1, 500, 13000)
    expect(confirmou.vigia.estado).toBe('ok')
    expect(confirmou.vigia.tentativas).toBe(0)
  })
})

describe('recepção: nunca chegou nada desde a assinatura', () => {
  it('duas amostras sem nada ainda não é motivo — pode não ter dado tempo de chegar', () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 2, 0)
    expect(vigia.estado).toBe('parada')
    expect(acoes).toEqual(['nada', 'nada'])
  })

  it(`manda reassinar depois de ${ESPERA_ANTES_DE_RETOMAR_MS} ms sem nenhum byte`, () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 6, 0)
    expect(acoes.filter((acao) => acao === 'reassinar')).toHaveLength(1)
    expect(vigia.estado).toBe('retomando')
    expect(vigia.tentativas).toBe(1)
  })

  it(`espera ${ESPERA_ENTRE_TENTATIVAS_MS} ms antes de tentar de novo`, () => {
    const { acoes } = correr(VIGIA_NOVO, 13, 0)
    expect(acoes.filter((acao) => acao === 'reassinar')).toHaveLength(2)
  })

  it(`desiste depois de ${TENTATIVAS_MAXIMAS} tentativas e para de agir`, () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 60, 0)
    expect(vigia.estado).toBe('desistiu')
    expect(acoes.filter((acao) => acao === 'reassinar')).toHaveLength(TENTATIVAS_MAXIMAS)
  })

  it('kbps nulo também conta como "nada chegou" — sem isso o vigia dormiria para sempre no exato perfil do bug', () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 10, null)
    expect(acoes.filter((acao) => acao === 'reassinar')).toHaveLength(1)
    expect(vigia.estado).toBe('retomando')
  })
})

describe('recepção: a tela que congela depois de chegar', () => {
  const entregou = () => correr(VIGIA_NOVO, 1, 900).vigia

  it(`um soluço menor que ${ESPERA_PARA_CONGELAR_MS} ms não é congelar`, () => {
    const { vigia, acoes } = correr(entregou(), ESPERA_PARA_CONGELAR_MS / 1000 - 1, 0, 1000)
    expect(vigia.estado).toBe('ok')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })

  it(`sem byte nenhum por ${ESPERA_PARA_CONGELAR_MS} ms, congela e manda reassinar`, () => {
    const { vigia, acoes } = correr(entregou(), ESPERA_PARA_CONGELAR_MS / 1000, 0, 1000)
    expect(vigia.estado).toBe('congelada')
    expect(acoes.at(-1)).toBe('reassinar')
  })

  it('kbps nulo também congela — a faixa sumida da assinatura é o mesmo sintoma', () => {
    const { vigia } = correr(entregou(), ESPERA_PARA_CONGELAR_MS / 1000, null, 1000)
    expect(vigia.estado).toBe('congelada')
  })

  it('o byte que volta desfaz o congelamento', () => {
    const congelada = correr(entregou(), 10, 0, 1000).vigia
    expect(congelada.estado).toBe('congelada')

    const { vigia } = correr(congelada, 1, 300, 11000)
    expect(vigia).toMatchObject({ estado: 'ok', paradaDesdeMs: null, tentativas: 0 })
  })

  it(`tenta ${TENTATIVAS_MAXIMAS} vezes e espera o "Tentar de novo", que reassina na hora`, () => {
    const { vigia, acoes } = correr(entregou(), 60, 0, 1000)
    expect(vigia.estado).toBe('congelada')
    expect(acoes.filter((acao) => acao === 'reassinar')).toHaveLength(TENTATIVAS_MAXIMAS)

    const rearmado = rearmarVigia(vigia, 62000)
    expect(rearmado.acao).toBe('reassinar')
    expect(rearmado.vigia).toMatchObject({ estado: 'congelada', tentativas: 1 })
    // Depois do clique, os ciclos automáticos voltam a valer.
    const depois = correr(rearmado.vigia, 9, 0, 62000)
    expect(depois.acoes).toContain('reassinar')
  })

  it('o "Tentar de novo" da tela que nunca chegou volta ao começo da vigilância', () => {
    const desistiu = correr(VIGIA_NOVO, 60, 0).vigia
    expect(rearmarVigia(desistiu, 61000)).toEqual({ vigia: VIGIA_NOVO, acao: 'nada' })
  })
})

describe('recepção: o dono que não manda nada', () => {
  it('tela que já chegou e cujo dono diz que não manda nada está parada, não congelada', () => {
    const entregou = correr(VIGIA_NOVO, 1, 900).vigia
    let vigia = entregou
    const acoes: string[] = []
    for (let i = 1; i <= 60; i += 1) {
      const agora = 1000 + i * 1000
      const passo = avaliarRecepcao(vigia, { emMs: agora, kbps: 0, donoEnviando: false }, agora)
      vigia = passo.vigia
      acoes.push(passo.acao)
    }
    expect(vigia.estado).toBe('ok')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })

  it('a congelada cujo dono parou de mandar volta a ser só parada', () => {
    const congelada = correr(correr(VIGIA_NOVO, 1, 900).vigia, 10, 0, 1000).vigia
    expect(congelada.estado).toBe('congelada')
    expect(avaliarRecepcao(congelada, { emMs: 12000, kbps: 0, donoEnviando: false }, 12000).vigia.estado).toBe('ok')
  })

  it('o dono calado não muda a fase do "nunca chegou" — a imagem de fato não chegou', () => {
    let vigia = VIGIA_NOVO
    for (let i = 1; i <= 6; i += 1) vigia = avaliarRecepcao(vigia, { emMs: i * 1000, kbps: 0, donoEnviando: false }, i * 1000).vigia
    expect(vigia.estado).toBe('retomando')
  })
})

describe('recepção: a tela pausada por quem compartilha', () => {
  it('pausada não congela: nada chegar é o combinado', () => {
    const entregou = correr(VIGIA_NOVO, 1, 900).vigia
    const { vigia, acoes } = correr(entregou, 60, 0, 1000, true)
    expect(vigia.estado).toBe('ok')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })

  it('pausada desde a assinatura também não vira "nunca chegou"', () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 60, 0, 0, true)
    expect(vigia.estado).toBe('parada')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })

  it('a congelada que é pausada passa a ser só pausada; despausar recomeça a contar do zero', () => {
    const congelada = correr(correr(VIGIA_NOVO, 1, 900).vigia, 10, 0, 1000).vigia
    const pausada = correr(congelada, 1, 0, 11000, true).vigia
    expect(pausada).toMatchObject({ estado: 'ok', paradaDesdeMs: null })

    const voltou = correr(pausada, ESPERA_PARA_CONGELAR_MS / 1000 - 1, 0, 12000)
    expect(voltou.vigia.estado).toBe('ok')
  })
})
