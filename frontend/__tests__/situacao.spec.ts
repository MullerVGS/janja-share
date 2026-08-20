import { describe, expect, it } from 'vitest'
import type { Convite } from '../src/api/convites'
import { situacaoDoConvite } from '../src/telas/Admin/situacao'

/**
 * Cada caso diz as duas coisas que o painel recebe: o veredito do backend (`ativo`) e os campos
 * de onde sai o motivo. Fixture com `ativo: true` e usos esgotados não existe em produção — o
 * backend calcula os dois com a mesma regra —, então nenhum teste aqui inventa um.
 */
function convite(parcial: Partial<Convite> = {}): Convite {
  return {
    id: 'c1',
    rotulo: 'Pessoal',
    criadoEm: '2026-08-19T12:00:00Z',
    expiraEm: '2026-08-21T12:00:00Z',
    usosMax: 5,
    usos: 0,
    revogadoEm: null,
    ativo: true,
    ...parcial,
  }
}

describe('situação do convite', () => {
  it('convite que o backend diz ativo está ativo', () => {
    expect(situacaoDoConvite(convite())).toBe('ativo')
  })

  it('revogado vence expirado — é a informação que muda o que o admin faz', () => {
    const morto = convite({
      ativo: false,
      revogadoEm: '2026-08-19T13:00:00Z',
      expiraEm: '2026-08-19T14:00:00Z',
      usos: 5,
    })
    expect(situacaoDoConvite(morto)).toBe('revogado')
  })

  it('inativo sem revogação e com uso sobrando é prazo vencido', () => {
    expect(situacaoDoConvite(convite({ ativo: false, expiraEm: '2026-08-20T11:59:00Z' }))).toBe('expirado')
  })

  it('inativo com usos no limite é esgotado', () => {
    expect(situacaoDoConvite(convite({ ativo: false, usos: 5, usosMax: 5 }))).toBe('esgotado')
  })

  it('usosMax nulo é ilimitado — nunca esgota', () => {
    expect(situacaoDoConvite(convite({ usos: 999, usosMax: null }))).toBe('ativo')
  })

  it('o veredito é o do backend, não o do relógio do navegador', () => {
    // Relógio local adiantado (ou o do servidor atrasado): o prazo parece vencido aqui, mas quem
    // decide quem entra é o backend, e ele disse que este convite ainda vale.
    expect(situacaoDoConvite(convite({ ativo: true, expiraEm: '2020-01-01T00:00:00Z' }))).toBe('ativo')
    // E o contrário: o backend já não deixa mais entrar, mesmo com o prazo parecendo longe.
    expect(situacaoDoConvite(convite({ ativo: false, expiraEm: '2099-01-01T00:00:00Z' }))).toBe('expirado')
  })
})
