import { MuitasGuardadas, MuitasSalas } from '../src/shared/erros'
import { SalaNoSfu } from '../src/shared/livekit/livekit-room.provider'
import { conferirTeto, TETO_ACORDADAS, TETO_ADORMECIDAS } from '../src/salas/teto'

function salas(quantas: number, molde: Partial<SalaNoSfu>): SalaNoSfu[] {
  return Array.from({ length: quantas }, (_, i) => ({
    slug: `sala-${i}`,
    nomeNoSfu: `sala-${i}-x`,
    nome: `Sala ${i}`,
    pessoas: [],
    telasNoAr: 0,
    cheia: false,
    ...molde,
  }))
}

describe('teto das salas', () => {
  it('as adormecidas não contam no teto das acordadas', () => {
    const lista = [...salas(TETO_ACORDADAS - 1, { pessoas: ['Ana'] }), ...salas(50, { fixa: true })]

    expect(() => conferirTeto(lista, true)).not.toThrow()
  })

  it('20 acordadas barram qualquer Sala nova, fixa ou efêmera', () => {
    const lista = salas(TETO_ACORDADAS, { pessoas: ['Ana'], fixa: true })

    expect(() => conferirTeto(lista, true)).toThrow(MuitasSalas)
    expect(() => conferirTeto(lista, false)).toThrow(MuitasSalas)
  })

  it('a efêmera vazia na carência ainda conta como acordada', () => {
    expect(() => conferirTeto(salas(TETO_ACORDADAS, { fixa: false }), false)).toThrow(MuitasSalas)
  })

  it('o teto das adormecidas barra só a fixa; a efêmera continua nascendo', () => {
    const lista = salas(TETO_ADORMECIDAS, { fixa: true })

    expect(() => conferirTeto(lista, true)).toThrow(MuitasGuardadas)
    expect(() => conferirTeto(lista, false)).not.toThrow()
  })
})
