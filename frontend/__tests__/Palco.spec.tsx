import { act, fireEvent, render, screen, within, type RenderResult } from '@testing-library/react'
import { Track, type TrackPublication } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Peca } from '../src/sala/palco'
import { useZoom } from '../src/sala/useZoom'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { Palco } from '../src/telas/Sala/Palco'
import { habilitarTelaCheia } from './apoio/navegador'
import { peca, volumesFalsos } from './apoio/pecas'
import { publicacaoFalsa } from './apoio/salaFalsa'

/** Uma câmera aberta: peça de pessoa com imagem, que é o que a põe no palco. */
const publicacaoDeCamera = () => publicacaoFalsa(Track.Source.Camera) as unknown as TrackPublication

interface Cenario {
  emDestaque?: Peca | null
  miniaturas?: Peca[]
  aoFocar?: (chave: string) => void
  aoAlternarImersao?: () => void
  volumes?: ControleDeVolumes
  /** A sala inteira começa com a interface visível; testar o oposto é escolha explícita do teste. */
  interfaceVisivel?: boolean
  aoTentarDeNovo?: (identidade: string) => void
}

function Palquinho({
  emDestaque = null,
  miniaturas = [],
  aoFocar = vi.fn(),
  aoAlternarImersao = vi.fn(),
  volumes = volumesFalsos(),
  interfaceVisivel = true,
  aoTentarDeNovo = vi.fn(),
}: Cenario) {
  const zoom = useZoom(emDestaque ? [emDestaque, ...miniaturas] : miniaturas)
  return (
    <Palco
      emDestaque={emDestaque}
      miniaturas={miniaturas}
      aoFocar={aoFocar}
      aoAlternarImersao={aoAlternarImersao}
      volumes={volumes}
      interfaceVisivel={interfaceVisivel}
      zoom={zoom}
      aoTentarDeNovo={aoTentarDeNovo}
    />
  )
}

function montarPalco(cenario: Cenario) {
  return render(<Palquinho {...cenario} />)
}

/** A área da imagem: onde o clique, o duplo clique e os gestos do zoom acontecem. */
function imagemDe(resultado: RenderResult): HTMLElement {
  return resultado.container.querySelector('[data-imagem]') as HTMLElement
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
function medir(resultado: RenderResult) {
  const imagem = imagemDe(resultado)
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

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('palco: o quadro em destaque', () => {
  it('a pílula da esquerda diz de quem é a imagem', () => {
    montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
    expect(screen.getByText('Tela de Bia')).toBeInTheDocument()

    montarPalco({ emDestaque: peca('Ana', { proprio: true }) })
    expect(screen.getByText('Ana (você)')).toBeInTheDocument()
  })

  it('sem imagem nenhuma no ar, o palco diz isso em vez de desenhar um retângulo vazio', () => {
    montarPalco({ emDestaque: null })
    expect(screen.getByText('Nada no ar ainda.')).toBeInTheDocument()
  })

  it('quem está sem imagem aparece pelas iniciais, sem vídeo nenhum para aproximar', () => {
    const resultado = montarPalco({ emDestaque: peca('Ana', { proprio: true, publicacao: undefined }) })
    expect(resultado.container.querySelector('video')).toBeNull()
    expect(screen.getByText('AN')).toBeInTheDocument()
  })
})

describe('palco: as miniaturas', () => {
  it('clicar numa miniatura a põe no destaque', () => {
    const aoFocar = vi.fn()
    montarPalco({
      emDestaque: peca('Bia', { ehTela: true }),
      miniaturas: [peca('Caio', { ehTela: true })],
      aoFocar,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Pôr a tela de Caio no palco' }))
    expect(aoFocar).toHaveBeenCalledExactlyOnceWith('tela:Caio')
  })

  it('sem ninguém fora do destaque, não há coluna de miniaturas', () => {
    montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
    expect(screen.queryByRole('button', { name: /^Pôr /})).not.toBeInTheDocument()
  })
})

describe('palco: o volume do quadro em destaque', () => {
  it('o som da tela alheia aparece sem hover, na pílula da direita', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, temAudio: true }) })
    expect(screen.getByRole('button', { name: 'Calar o som da tela de Sadia' })).toBeInTheDocument()
  })

  it('a voz alheia também aparece sem hover — mesmo controle, mesmo lugar', () => {
    montarPalco({ emDestaque: peca('Caio') })

    expect(screen.getByRole('button', { name: 'Calar a voz de Caio' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume da voz de Caio' })).toBeInTheDocument()
  })

  it('o seu próprio quadro não tem volume local: não há controle nenhum', () => {
    montarPalco({ emDestaque: peca('Ana', { proprio: true }) })
    expect(screen.queryByRole('button', { name: /Calar a voz de Ana/ })).not.toBeInTheDocument()
  })

  it('com o controle à vista, o microfone fechado aparece nele — sem ícone avulso dobrado', () => {
    const { container } = montarPalco({ emDestaque: peca('Caio', { microfoneLigado: false }) })

    const botao = screen.getByRole('button', { name: 'Calar a voz de Caio' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', 'microfone fechado')
    expect(container.querySelectorAll('[title="microfone fechado"]')).toHaveLength(2)
  })

  it('clicar no som da tela alheia cala e devolve pelo tipo "tela", não "pessoa"', () => {
    const volumes = volumesFalsos({ Sadia: { tela: 0 } })
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, temAudio: true }), volumes })

    const botao = screen.getByRole('button', { name: 'Devolver o som da tela de Sadia' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(botao)
    expect(volumes.alternarMudo).toHaveBeenCalledWith('Sadia', 'tela')
  })
})

describe('palco: o aviso do cão de guarda', () => {
  it('enquanto tenta, conta que a tela ainda não chegou — e não oferece botão nenhum', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, recepcao: 'retomando' }) })

    expect(screen.getByRole('status')).toHaveTextContent('a tela de Sadia ainda não chegou aqui — tentando de novo…')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })

  /**
   * `'desistiu'` é estado absorvente: o vigia não tenta uma quarta vez sozinho. Sem este botão o
   * produto final do cão de guarda seria mandar o espectador pedir para o outro reiniciar a
   * transmissão — exatamente a dependência que ele existe para eliminar (§4 do desenho).
   */
  it('depois de desistir, o botão rearma o vigia daquela tela — sem depender de quem transmite', () => {
    const aoTentarDeNovo = vi.fn()
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, recepcao: 'desistiu' }), aoTentarDeNovo })

    expect(screen.getByRole('status')).toHaveTextContent('a tela de Sadia nunca chegou aqui.')
    // A frase antiga mandava pedir para a outra pessoa reiniciar: é o que o botão substitui.
    expect(screen.getByRole('status')).not.toHaveTextContent(/reiniciar/i)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(aoTentarDeNovo).toHaveBeenCalledExactlyOnceWith('sadia')
  })

  it('em tela cheia o aviso continua desenhado — é status, não moldura', () => {
    const telaCheia = habilitarTelaCheia()
    const resultado = montarPalco({ emDestaque: peca('Sadia', { ehTela: true, recepcao: 'desistiu' }) })

    clicarDuas(imagemDe(resultado))
    expect(telaCheia.atual).not.toBeNull()

    const aviso = screen.getByRole('status')
    expect(aviso).toBeInTheDocument()
    expect(getComputedStyle(aviso).display).not.toBe('none')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('tela que chega bem não tem aviso nenhum', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, recepcao: 'ok' }) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('palco: clique e duplo clique na imagem', () => {
  it('um clique alterna a imersão — é o "clicar na live esconde os painéis"', () => {
    const aoAlternarImersao = vi.fn()
    const aoFocar = vi.fn()
    const resultado = montarPalco({ emDestaque: peca('Bia', { ehTela: true }), aoAlternarImersao, aoFocar })

    clicar(imagemDe(resultado))

    expect(aoAlternarImersao).toHaveBeenCalledOnce()
    expect(aoFocar).not.toHaveBeenCalled()
  })

  it('o duplo clique põe o quadro em tela cheia e o Esc devolve — sem passar pela imersão', () => {
    const telaCheia = habilitarTelaCheia()
    const aoAlternarImersao = vi.fn()
    const resultado = montarPalco({ emDestaque: peca('Bia', { ehTela: true }), aoAlternarImersao })

    clicarDuas(imagemDe(resultado))

    expect(telaCheia.atual).toBe(resultado.container.querySelector('[data-tela]'))
    act(() => vi.advanceTimersByTime(250))
    expect(aoAlternarImersao).not.toHaveBeenCalled()

    act(() => telaCheia.sair())
    expect(resultado.container.querySelector('[data-cheia]')).toBeNull()
  })

  it('em tela cheia nada é desenhado até o mouse mexer, e a pílula some 2 s depois', () => {
    const telaCheia = habilitarTelaCheia()
    const resultado = montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
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
})

describe('palco: as pílulas seguem a interface flutuante', () => {
  it('com a interface à mostra elas existem; escondida, não', () => {
    // `within(container)`, e não a query já ligada ao `render`: as duas montagens desta prova
    // vivem no mesmo `document.body`, e a query ligada busca o corpo inteiro por padrão.
    const visivel = montarPalco({ emDestaque: peca('Bia', { ehTela: true }), interfaceVisivel: true })
    expect(within(visivel.container).getByRole('button', { name: 'Ver em 1:1' })).toBeInTheDocument()
    expect(within(visivel.container).getByText('Tela de Bia')).toBeInTheDocument()

    const oculta = montarPalco({ emDestaque: peca('Bia', { ehTela: true }), interfaceVisivel: false })
    expect(within(oculta.container).queryByRole('button', { name: 'Ver em 1:1' })).not.toBeInTheDocument()
    expect(within(oculta.container).queryByText('Tela de Bia')).not.toBeInTheDocument()
  })
})

describe('palco: o zoom no quadro em destaque', () => {
  it('a roda aproxima a imagem e segura a rolagem da página', () => {
    const resultado = montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
    const { imagem, video } = medir(resultado)
    expect(video.style.transform).toBe('translate(0px, 0px) scale(1)')

    const evento = girar(imagem, -100)

    expect(evento.defaultPrevented).toBe(true)
    expect(video.style.transform).toBe('translate(0px, 0px) scale(1.1)')
  })

  it('numa câmera a roda não faz nada — aproximar um rosto seria gesto sem propósito', () => {
    const resultado = montarPalco({ emDestaque: peca('Caio', { publicacao: publicacaoDeCamera() }) })
    const { imagem } = medir(resultado)

    const evento = girar(imagem, -100)

    expect(evento.defaultPrevented).toBe(false)
  })

  it('caber e 1:1 da pílula mexem no zoom daquela peça', () => {
    const resultado = montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
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
})
