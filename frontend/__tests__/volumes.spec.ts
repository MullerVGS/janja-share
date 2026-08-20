import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { lerPreferencias } from '../src/preferencias'
import { comVolume, lerVolumes, VOLUME_CHEIO, volumeDe, type Volumes } from '../src/sala/volumes'
import { useVolumes } from '../src/sala/useVolumes'

afterEach(() => localStorage.clear())

describe('volumes: o mapa por nome', () => {
  it('nome que ninguém mexeu toca inteiro', () => {
    expect(volumeDe({}, 'Ana', 'pessoa')).toBe(VOLUME_CHEIO)
    expect(volumeDe({ Ana: { tela: 40 } }, 'Ana', 'pessoa')).toBe(VOLUME_CHEIO)
  })

  it('pessoa e tela do mesmo nome são volumes separados', () => {
    const volumes = comVolume(comVolume({}, 'Ana', 'pessoa', 30), 'Ana', 'tela', 80)
    expect(volumeDe(volumes, 'Ana', 'pessoa')).toBe(30)
    expect(volumeDe(volumes, 'Ana', 'tela')).toBe(80)
  })

  it('guardar um volume não mexe nos outros nomes nem no mapa anterior', () => {
    const antes: Volumes = { Bia: { pessoa: 10 } }
    const depois = comVolume(antes, 'Ana', 'pessoa', 55)

    expect(volumeDe(depois, 'Bia', 'pessoa')).toBe(10)
    expect(antes).toEqual({ Bia: { pessoa: 10 } })
  })

  it('o volume entra limitado a 0–100 e inteiro', () => {
    expect(volumeDe(comVolume({}, 'Ana', 'tela', 140), 'Ana', 'tela')).toBe(100)
    expect(volumeDe(comVolume({}, 'Ana', 'tela', -20), 'Ana', 'tela')).toBe(0)
    expect(volumeDe(comVolume({}, 'Ana', 'tela', 33.7), 'Ana', 'tela')).toBe(34)
  })

  it('o nome é a chave já aparada — a etiqueta do quadro e o disco falam do mesmo alguém', () => {
    const volumes = comVolume({}, '  Ana  ', 'tela', 20)
    expect(volumeDe(volumes, 'Ana', 'tela')).toBe(20)
    expect(Object.keys(volumes)).toEqual(['Ana'])
  })
})

describe('volumes: leitura do que estava no disco', () => {
  it('o que não é objeto não vira mapa nenhum', () => {
    expect(lerVolumes('alto')).toBeUndefined()
    expect(lerVolumes(null)).toBeUndefined()
    expect(lerVolumes([1, 2])).toBeUndefined()
  })

  it('entrada estragada some; o resto do mapa fica', () => {
    expect(
      lerVolumes({
        Ana: { pessoa: 40, tela: 200 },
        Bia: 'baixo',
        Caio: { tela: 60 },
        Dora: { pessoa: 'meio' },
      }),
    ).toEqual({ Ana: { pessoa: 40 }, Caio: { tela: 60 } })
  })
})

describe('useVolumes', () => {
  it('nasce do que está guardado e persiste cada mexida por nome', () => {
    localStorage.setItem('share.preferencias', JSON.stringify({ versao: 1, volumes: { Bia: { tela: 25 } } }))
    const { result } = renderHook(() => useVolumes())
    expect(result.current.volumeDe('Bia', 'tela')).toBe(25)

    act(() => result.current.definir('Ana', 'pessoa', 70))

    expect(result.current.volumeDe('Ana', 'pessoa')).toBe(70)
    expect(lerPreferencias().volumes).toEqual({ Bia: { tela: 25 }, Ana: { pessoa: 70 } })
  })

  it('o mudo zera lembrando o volume, e o clique de volta devolve o que estava lá', () => {
    const { result } = renderHook(() => useVolumes())
    act(() => result.current.definir('Ana', 'tela', 45))

    act(() => result.current.alternarMudo('Ana', 'tela'))
    expect(result.current.volumeDe('Ana', 'tela')).toBe(0)

    act(() => result.current.alternarMudo('Ana', 'tela'))
    expect(result.current.volumeDe('Ana', 'tela')).toBe(45)
  })

  it('mudo que veio do disco não tem lembrança: sair dele devolve o volume inteiro', () => {
    localStorage.setItem('share.preferencias', JSON.stringify({ versao: 1, volumes: { Bia: { pessoa: 0 } } }))
    const { result } = renderHook(() => useVolumes())

    act(() => result.current.alternarMudo('Bia', 'pessoa'))

    expect(result.current.volumeDe('Bia', 'pessoa')).toBe(VOLUME_CHEIO)
  })
})
