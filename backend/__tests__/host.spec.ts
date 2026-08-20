import { hostBate } from '../src/shared/host'

describe('hostBate', () => {
  const ADMIN = 'admin.example.com'

  it('bate com o host exato', () => {
    expect(hostBate(ADMIN, ADMIN)).toBe(true)
  })

  it('ignora caixa', () => {
    expect(hostBate('Share-Admin.example.com', ADMIN)).toBe(true)
  })

  it('ignora porta em ambos os lados', () => {
    expect(hostBate(`${ADMIN}:8443`, ADMIN)).toBe(true)
    expect(hostBate(ADMIN, `${ADMIN}:3000`)).toBe(true)
  })

  it('rejeita host diferente', () => {
    expect(hostBate('share.example.com', ADMIN)).toBe(false)
  })

  it('rejeita ausência de header Host', () => {
    expect(hostBate(undefined, ADMIN)).toBe(false)
  })
})
