import { calcularEstado, DadosConvite } from '../src/convites/estado-convite'

const AGORA = new Date('2026-08-20T12:00:00Z')
const HORA_FUTURA = new Date('2026-08-20T18:00:00Z')
const HORA_PASSADA = new Date('2026-08-20T06:00:00Z')

function convite(overrides: Partial<DadosConvite> = {}): DadosConvite {
  return { expiraEm: HORA_FUTURA, revogadoEm: null, usos: 0, usosMax: null, ...overrides }
}

describe('calcularEstado', () => {
  it('válido: não revogado, não expirado, dentro do limite de usos', () => {
    expect(calcularEstado(convite(), AGORA)).toBe('valido')
  })

  it('válido: usosMax null é ilimitado, mesmo com muitos usos', () => {
    expect(calcularEstado(convite({ usosMax: null, usos: 9999 }), AGORA)).toBe('valido')
  })

  it('expirado: expiraEm no passado', () => {
    expect(calcularEstado(convite({ expiraEm: HORA_PASSADA }), AGORA)).toBe('expirado')
  })

  it('expirado: expiraEm exatamente agora conta como expirado (limite inclusivo)', () => {
    expect(calcularEstado(convite({ expiraEm: AGORA }), AGORA)).toBe('expirado')
  })

  it('revogado: revogadoEm definido', () => {
    expect(calcularEstado(convite({ revogadoEm: new Date('2026-08-19T00:00:00Z') }), AGORA)).toBe('revogado')
  })

  it('esgotado: usos atingiu usosMax', () => {
    expect(calcularEstado(convite({ usosMax: 3, usos: 3 }), AGORA)).toBe('esgotado')
  })

  it('não esgotado: usos abaixo de usosMax', () => {
    expect(calcularEstado(convite({ usosMax: 3, usos: 2 }), AGORA)).toBe('valido')
  })

  it('prioridade: revogado vence mesmo se também expirado e esgotado', () => {
    const c = convite({ revogadoEm: new Date(), expiraEm: HORA_PASSADA, usosMax: 1, usos: 1 })
    expect(calcularEstado(c, AGORA)).toBe('revogado')
  })

  it('prioridade: expirado vence sobre esgotado quando não revogado', () => {
    const c = convite({ expiraEm: HORA_PASSADA, usosMax: 1, usos: 1 })
    expect(calcularEstado(c, AGORA)).toBe('expirado')
  })
})
