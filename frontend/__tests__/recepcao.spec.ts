import { describe, expect, it } from 'vitest'
import {
  avaliarRecepcao, ESPERA_ANTES_DE_RETOMAR_MS, ESPERA_ENTRE_TENTATIVAS_MS,
  TENTATIVAS_MAXIMAS, VIGIA_NOVO, type Vigia,
} from '../src/sala/recepcao'

/** Alimenta o vigia como o coletor faz: uma amostra por segundo. */
function correr(vigia: Vigia, segundos: number, kbps: number | null, desde = 0) {
  let atual = vigia
  const acoes: string[] = []
  for (let i = 1; i <= segundos; i += 1) {
    const agora = desde + i * 1000
    const passo = avaliarRecepcao(atual, { emMs: agora, kbps }, agora)
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

  it('uma amostra positiva no meio de um ciclo de tentativas encerra a vigilância para sempre — mesmo que a tela zere de novo depois', () => {
    const emCiclo = correr(VIGIA_NOVO, 13, 0)
    expect(emCiclo.acoes.filter((acao) => acao === 'reassinar')).toHaveLength(2) // já em pleno ciclo, sanity check

    const confirmou = correr(emCiclo.vigia, 1, 500, 13000)
    expect(confirmou.vigia.estado).toBe('ok')

    const paradaLegitimaDepois = correr(confirmou.vigia, 30, 0, 14000)
    expect(paradaLegitimaDepois.vigia.estado).toBe('ok')
    expect(paradaLegitimaDepois.acoes.every((acao) => acao === 'nada')).toBe(true)
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

describe('recepção: tela que já entregou fica em paz quando fica ociosa', () => {
  it('bitrate que já chegou uma vez e depois zera não é motivo — é parada legítima, não o bug', () => {
    const entregou = correr(VIGIA_NOVO, 1, 900)
    expect(entregou.vigia.estado).toBe('ok')

    const { vigia, acoes } = correr(entregou.vigia, 60, 0, 1000)
    expect(vigia.estado).toBe('ok')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })
})
