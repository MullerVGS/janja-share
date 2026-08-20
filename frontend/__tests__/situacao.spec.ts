import { describe, expect, it } from 'vitest'
import type { Convite } from '../src/api/convites'
import { situacaoDoConvite } from '../src/telas/Admin/situacao'

const AGORA = new Date('2026-08-20T12:00:00Z').getTime()

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
  it('convite dentro do prazo e com uso sobrando está ativo', () => {
    expect(situacaoDoConvite(convite(), AGORA)).toBe('ativo')
  })

  it('revogado vence expirado — é a informação que muda o que o admin faz', () => {
    const morto = convite({ revogadoEm: '2026-08-19T13:00:00Z', expiraEm: '2026-08-19T14:00:00Z', usos: 5 })
    expect(situacaoDoConvite(morto, AGORA)).toBe('revogado')
  })

  it('prazo vencido é expirado', () => {
    expect(situacaoDoConvite(convite({ expiraEm: '2026-08-20T11:59:00Z' }), AGORA)).toBe('expirado')
  })

  it('usos no limite é esgotado', () => {
    expect(situacaoDoConvite(convite({ usos: 5, usosMax: 5 }), AGORA)).toBe('esgotado')
  })

  it('usosMax nulo é ilimitado — nunca esgota', () => {
    expect(situacaoDoConvite(convite({ usos: 999, usosMax: null }), AGORA)).toBe('ativo')
  })
})
