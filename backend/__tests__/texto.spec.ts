import { slug } from '../src/convites/texto'

describe('slug', () => {
  it('coloca em minúsculas', () => {
    expect(slug('Ana')).toBe('ana')
  })

  it('remove acentos', () => {
    expect(slug('José André')).toBe('jose-andre')
  })

  it('troca não-alfanuméricos por hífen e colapsa repetições', () => {
    expect(slug('a  b__c!!d')).toBe('a-b-c-d')
  })

  it('remove hífens nas pontas', () => {
    expect(slug('-Ana-')).toBe('ana')
  })

  it('cai no fallback "convidado" quando não sobra nada representável', () => {
    expect(slug('😀😀')).toBe('convidado')
  })
})
