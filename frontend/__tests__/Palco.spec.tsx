import { act, fireEvent, render, screen, type RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Peca } from '../src/sala/palco'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { useZoom } from '../src/sala/useZoom'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { Palco } from '../src/telas/Sala/Palco'
import { compartilhamentoFalso } from './apoio/compartilhamentoFalso'
import { habilitarTelaCheia } from './apoio/navegador'
import { peca, volumesFalsos } from './apoio/pecas'

interface Cenario {
  pecas: Peca[]
  emFoco?: boolean
  aoSoltarOFoco?: () => void
  aoFocar?: (chave: string) => void
  volumes?: ControleDeVolumes
  compartilhamento?: Compartilhamento
}

function Palquinho({
  pecas,
  emFoco = false,
  aoSoltarOFoco = vi.fn(),
  aoFocar = vi.fn(),
  volumes = volumesFalsos(),
  compartilhamento = compartilhamentoFalso(),
}: Cenario) {
  const zoom = useZoom(pecas)
  return (
    <Palco
      pecas={pecas}
      emFoco={emFoco}
      aoSoltarOFoco={aoSoltarOFoco}
      aoFocar={aoFocar}
      volumes={volumes}
      compartilhamento={compartilhamento}
      zoom={zoom}
    />
  )
}

function montarPalco(cenario: Cenario) {
  return render(<Palquinho {...cenario} />)
}

/** A área da imagem: onde o clique, o duplo clique e os gestos do zoom acontecem. */
function imagemDe(resultado: RenderResult, indice = 0): HTMLElement {
  return resultado.container.querySelectorAll('[data-imagem]')[indice] as HTMLElement
}

function bater(elemento: HTMLElement) {
  fireEvent.pointerDown(elemento, { pointerId: 1, clientX: 10, clientY: 10 })
  fireEvent.pointerUp(elemento, { pointerId: 1, clientX: 10, clientY: 10 })
}

function clicar(elemento: HTMLElement) {
  bater(elemento)
  act(() => vi.advanceTimersByTime(250))
}

function clicarDuas(elemento: HTMLElement) {
  bater(elemento)
  act(() => vi.advanceTimersByTime(100))
  bater(elemento)
}

/** O jsdom não mede nada: quem responde pelo tamanho do quadro e da imagem é o teste. */
function medir(resultado: RenderResult, indice = 0) {
  const imagem = imagemDe(resultado, indice)
  imagem.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 }) as DOMRect
  const video = imagem.querySelector('video') as HTMLVideoElement
  Object.defineProperty(video, 'videoWidth', { value: 1000, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: 500, configurable: true })
  return { imagem, video }
}

function girar(elemento: HTMLElement, deltaY: number): WheelEvent {
  const evento = new WheelEvent('wheel', { deltaY, clientX: 500, clientY: 250, bubbles: true, cancelable: true })
  act(() => {
    elemento.dispatchEvent(evento)
  })
  return evento
}

/** O `Element.animate` não existe no jsdom, e o `getBoundingClientRect` mede sempre zero. */
const medidaDeVerdade = Element.prototype.getBoundingClientRect

function medirTudoComo(retangulo: { left: number; top: number; width: number; height: number }) {
  Element.prototype.getBoundingClientRect = () => retangulo as DOMRect
}

function gravarAnimacoes(): Keyframe[][] {
  const gravadas: Keyframe[][] = []
  Element.prototype.animate = ((quadros: Keyframe[]) => {
    gravadas.push(quadros)
    return {} as Animation
  }) as Element['animate']
  return gravadas
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  Element.prototype.getBoundingClientRect = medidaDeVerdade
  Reflect.deleteProperty(Element.prototype, 'animate')
})

describe('palco: a grade', () => {
  it('lista tudo que existe na sala — as telas e as pessoas', () => {
    montarPalco({ pecas: [peca('Bia', { ehTela: true }), peca('Bia'), peca('Ana', { proprio: true })] })

    expect(screen.getByText('Bia · tela')).toBeInTheDocument()
    expect(screen.getByText('Bia')).toBeInTheDocument()
    expect(screen.getByText('Ana (você)')).toBeInTheDocument()
  })

  it('sem ninguém, diz que a sala está vazia', () => {
    montarPalco({ pecas: [] })
    expect(screen.getByText('Você é a primeira pessoa aqui.')).toBeInTheDocument()
  })

  it('clicar num quadro foca nele — e só depois dos 250 ms que o separam do duplo clique', () => {
    const aoFocar = vi.fn()
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true }), peca('Caio')], aoFocar })

    bater(imagemDe(resultado, 1))
    expect(aoFocar).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(250))
    expect(aoFocar).toHaveBeenCalledWith('pessoa:Caio')
  })
})

describe('palco: a etiqueta', () => {
  it('o som da tela alheia aparece sem hover', () => {
    montarPalco({ pecas: [peca('Sadia', { ehTela: true, temAudio: true })] })
    expect(screen.getByRole('button', { name: 'Calar o som da tela de Sadia' })).toBeInTheDocument()
  })
})

describe('palco: o foco', () => {
  it('clicar na imagem em foco solta o foco — é o "clicar na live faz ela ficar menor"', () => {
    const aoSoltarOFoco = vi.fn()
    const aoFocar = vi.fn()
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true, aoSoltarOFoco, aoFocar })

    clicar(imagemDe(resultado))

    expect(aoSoltarOFoco).toHaveBeenCalledOnce()
    expect(aoFocar).not.toHaveBeenCalled()
  })

  it('a peça em foco ocupa tudo; a grade divide o espaço', () => {
    const emFoco = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true })
    expect(emFoco.container.firstElementChild).toHaveAttribute('data-modo', 'foco')

    const naGrade = montarPalco({ pecas: [peca('Bia', { ehTela: true })] })
    expect(naGrade.container.firstElementChild).toHaveAttribute('data-modo', 'grade')
  })
})

describe('palco: tela cheia', () => {
  it('o duplo clique põe o quadro em tela cheia e o Esc devolve', () => {
    const telaCheia = habilitarTelaCheia()
    const aoSoltarOFoco = vi.fn()
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true, aoSoltarOFoco })

    clicarDuas(imagemDe(resultado))

    expect(telaCheia.atual).toBe(resultado.container.querySelector('[data-tela]'))
    // O duplo clique não é um clique: o foco não pode ter sido solto no caminho.
    act(() => vi.advanceTimersByTime(250))
    expect(aoSoltarOFoco).not.toHaveBeenCalled()

    act(() => telaCheia.sair())
    expect(resultado.container.querySelector('[data-cheia]')).toBeNull()
  })

  it('lá dentro nada é desenhado até o mouse mexer, e a pílula some 2 s depois', () => {
    const telaCheia = habilitarTelaCheia()
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true })
    const umPorUm = { name: 'Ver em 1:1' } as const

    clicarDuas(imagemDe(resultado))
    expect(telaCheia.atual).not.toBeNull()
    expect(screen.queryByRole('button', umPorUm)).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(screen.getByRole('button', umPorUm)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1999))
    expect(screen.getByRole('button', umPorUm)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('button', umPorUm)).toBeNull()
  })

  it('fora da tela cheia a pílula está sempre desenhada — quem a esconde é o hover, no CSS', () => {
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true })
    expect(imagemDe(resultado)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver em 1:1' })).toBeInTheDocument()
  })
})

describe('palco: a peça cresce e encolhe', () => {
  it('sair do foco anima a peça do tamanho que ela tinha até o que ela passou a ter', () => {
    const animacoes = gravarAnimacoes()
    medirTudoComo({ left: 0, top: 0, width: 600, height: 300 })
    const pecas = [peca('Bia', { ehTela: true })]
    const resultado = render(<Palquinho pecas={pecas} emFoco />)

    medirTudoComo({ left: 10, top: 10, width: 300, height: 150 })
    resultado.rerender(<Palquinho pecas={pecas} emFoco={false} />)

    expect(animacoes).toHaveLength(1)
    expect(animacoes[0]?.[0]).toMatchObject({
      transform: 'translate(-10px, -10px) scale(2, 2)',
      transformOrigin: 'top left',
    })
    expect(animacoes[0]?.[1]).toMatchObject({ transform: 'none' })
  })

  it('re-render sem troca de modo não anima nada', () => {
    const animacoes = gravarAnimacoes()
    medirTudoComo({ left: 0, top: 0, width: 600, height: 300 })
    const pecas = [peca('Bia', { ehTela: true })]
    const resultado = render(<Palquinho pecas={pecas} emFoco />)

    medirTudoComo({ left: 10, top: 10, width: 300, height: 150 })
    resultado.rerender(<Palquinho pecas={pecas} emFoco />)

    expect(animacoes).toHaveLength(0)
  })
})

describe('palco: o zoom no quadro', () => {
  it('em foco, a roda aproxima a imagem e segura a rolagem da página', () => {
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true })
    const { imagem, video } = medir(resultado)
    expect(video.style.transform).toBe('translate(0px, 0px) scale(1)')

    const evento = girar(imagem, -100)

    expect(evento.defaultPrevented).toBe(true)
    expect(video.style.transform).toBe('translate(0px, 0px) scale(1.1)')
  })

  it('na grade a roda não faz nada — aproximar uma miniatura seria gesto sem propósito', () => {
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })] })
    const { imagem, video } = medir(resultado)

    const evento = girar(imagem, -100)

    expect(evento.defaultPrevented).toBe(false)
    expect(video.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('caber e 1:1 da pílula mexem no zoom daquela peça', () => {
    const resultado = montarPalco({ pecas: [peca('Bia', { ehTela: true })], emFoco: true })
    const { imagem, video } = medir(resultado)
    girar(imagem, -100)

    // 1:1 é a imagem no tamanho natural: aqui ela é o dobro do encaixe (2000 × 1000 num quadro de 1000 × 500).
    Object.defineProperty(video, 'videoWidth', { value: 2000, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 1000, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Ver em 1:1' }))
    expect(video.style.transform).toBe('translate(0px, 0px) scale(2)')

    fireEvent.click(screen.getByRole('button', { name: 'Fazer a tela caber no quadro' }))
    expect(video.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('quem está sem imagem aparece pelas iniciais, sem vídeo nenhum para aproximar', () => {
    const resultado = montarPalco({ pecas: [peca('Ana', { proprio: true, publicacao: undefined })] })
    expect(resultado.container.querySelector('video')).toBeNull()
    expect(screen.getByText('AN')).toBeInTheDocument()
  })
})
