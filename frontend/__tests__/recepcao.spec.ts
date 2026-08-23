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

describe('recepção: o que chega está bom', () => {
  it('bitrate vivo mantém tudo em ok e não age', () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 20, 1200)
    expect(vigia.estado).toBe('ok')
    expect(acoes.every((acao) => acao === 'nada')).toBe(true)
  })

  it('um zero isolado não é motivo — a rede pisca', () => {
    const { vigia, acoes } = correr(VIGIA_NOVO, 2, 0)
    expect(vigia.estado).toBe('parada')
    expect(acoes).toEqual(['nada', 'nada'])
  })
})

describe('recepção: nada chegando', () => {
  it(`manda reassinar depois de ${ESPERA_ANTES_DE_RETOMAR_MS} ms parada`, () => {
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

  it('bitrate voltando zera tudo, inclusive as tentativas gastas', () => {
    const parada = correr(VIGIA_NOVO, 6, 0)
    const voltou = correr(parada.vigia, 1, 900, 6000)
    expect(voltou.vigia.estado).toBe('ok')
    expect(voltou.vigia.tentativas).toBe(0)
    expect(voltou.vigia.paradaDesdeMs).toBeNull()
  })

  it('kbps nulo (primeira leitura da publicação) não conta como parada', () => {
    const { vigia } = correr(VIGIA_NOVO, 10, null)
    expect(vigia.estado).toBe('ok')
  })
})
