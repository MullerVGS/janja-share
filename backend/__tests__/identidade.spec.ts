import { gerarIdentidade } from '../src/salas/identidade'

// identity = <slug(nome)>-<6 hex> (contrato) — o sufixo hex muda a cada chamada, então as
// asserções checam só o prefixo.
const SUFIXO = /-[0-9a-f]{6}$/

describe('gerarIdentidade', () => {
  it('coloca em minúsculas', () => {
    expect(gerarIdentidade('Ana')).toMatch(/^ana-[0-9a-f]{6}$/)
  })

  it('remove acentos', () => {
    expect(gerarIdentidade('José André')).toMatch(/^jose-andre-[0-9a-f]{6}$/)
  })

  it('troca não-alfanuméricos por hífen e colapsa repetições', () => {
    expect(gerarIdentidade('a  b__c!!d')).toMatch(/^a-b-c-d-[0-9a-f]{6}$/)
  })

  it('remove hífens nas pontas', () => {
    expect(gerarIdentidade('-Ana-')).toMatch(/^ana-[0-9a-f]{6}$/)
  })

  it('cai no fallback "convidado" quando não sobra nada representável (nome só de emoji)', () => {
    expect(gerarIdentidade('😀😀')).toMatch(/^convidado-[0-9a-f]{6}$/)
  })

  it('duas chamadas para o mesmo nome geram sufixos diferentes', () => {
    const a = gerarIdentidade('Ana')
    const b = gerarIdentidade('Ana')
    expect(a).not.toBe(b)
    expect(a.replace(SUFIXO, '')).toBe(b.replace(SUFIXO, ''))
  })
})
