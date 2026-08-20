import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DA_SESSAO, ProvedorDeSessao, useSessao } from '../src/sessao/sessao'
import { credenciaisFalsas, guardarSessao } from './apoio/sessaoFalsa'

function envolucro({ children }: { children: ReactNode }) {
  return <ProvedorDeSessao>{children}</ProvedorDeSessao>
}

function montarSessao() {
  return renderHook(() => useSessao(), { wrapper: envolucro })
}

const DAQUI_A_UMA_HORA = () => Date.now() + 60 * 60 * 1000
const UMA_HORA_ATRAS = () => Date.now() - 60 * 60 * 1000

describe('sessão por slug', () => {
  afterEach(() => vi.useRealTimers())

  it('guarda e lê o slug certo; um slug diferente não vê a sessão do outro', () => {
    const { result } = montarSessao()
    const credenciaisA = credenciaisFalsas(DAQUI_A_UMA_HORA(), 'Ana', 'sala-a')

    act(() => result.current.guardar(credenciaisA))

    expect(result.current.credenciaisDe('sala-a')).toEqual(credenciaisA)
    expect(result.current.credenciaisDe('sala-b')).toBeNull()
  })

  it('slug nunca guardado devolve null', () => {
    const { result } = montarSessao()
    expect(result.current.credenciaisDe('nunca-existiu')).toBeNull()
  })

  it('formato anterior sem chave de slug é descartado', () => {
    sessionStorage.setItem(
      CHAVE_DA_SESSAO,
      JSON.stringify({
        credenciais: { token: 'x.y.z', urlSfu: 'wss://sfu', sala: 'share', identidade: 'a-1', nome: 'Ana' },
        expiraEm: DAQUI_A_UMA_HORA(),
      }),
    )
    const { result } = montarSessao()
    expect(result.current.credenciaisDe('share')).toBeNull()
  })

  it('sessão expirada devolve null', () => {
    guardarSessao(credenciaisFalsas(UMA_HORA_ATRAS(), 'Ana', 'sala-a'), UMA_HORA_ATRAS())
    const { result } = montarSessao()
    expect(result.current.credenciaisDe('sala-a')).toBeNull()
  })

  it('dois guardar no mesmo tick mantêm as duas salas — atualização funcional, não a closure do render', () => {
    const { result } = montarSessao()
    const credenciaisA = credenciaisFalsas(DAQUI_A_UMA_HORA(), 'Ana', 'sala-a')
    const credenciaisB = credenciaisFalsas(DAQUI_A_UMA_HORA(), 'Ana', 'sala-b')

    // As duas chamadas acontecem antes de qualquer re-render — se `guardar` espalhar o `mapa`
    // capturado pelo `useMemo` (em vez de uma atualização funcional), a segunda parte do mapa de
    // antes da primeira e apaga sala-a. É essa a garantia que o teste anterior não travava: ele
    // só conferia depois de um `encerrar('sala-a')`, que apaga sala-a de qualquer jeito.
    act(() => {
      result.current.guardar(credenciaisA)
      result.current.guardar(credenciaisB)
    })

    expect(result.current.credenciaisDe('sala-a')).toEqual(credenciaisA)
    expect(result.current.credenciaisDe('sala-b')).toEqual(credenciaisB)
  })

  it('encerrar uma sala não derruba a outra', () => {
    const { result } = montarSessao()
    const credenciaisA = credenciaisFalsas(DAQUI_A_UMA_HORA(), 'Ana', 'sala-a')
    const credenciaisB = credenciaisFalsas(DAQUI_A_UMA_HORA(), 'Ana', 'sala-b')

    act(() => {
      result.current.guardar(credenciaisA)
      result.current.guardar(credenciaisB)
    })
    expect(result.current.credenciaisDe('sala-a')).toEqual(credenciaisA)

    act(() => result.current.encerrar('sala-a'))

    expect(result.current.credenciaisDe('sala-a')).toBeNull()
    expect(result.current.credenciaisDe('sala-b')).toEqual(credenciaisB)
  })

  it('credenciaisDe reconfere a validade a cada chamada, não só na montagem', () => {
    const { result } = montarSessao()
    const daquiA31Segundos = Date.now() + 31_000

    act(() => result.current.guardar(credenciaisFalsas(daquiA31Segundos, 'Ana', 'sala-a')))
    expect(result.current.credenciaisDe('sala-a')).not.toBeNull()

    vi.setSystemTime(Date.now() + 32_000)
    expect(result.current.credenciaisDe('sala-a')).toBeNull()

    vi.useRealTimers()
  })
})
