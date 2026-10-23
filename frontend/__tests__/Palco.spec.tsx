import { act, fireEvent, render, screen, within, type RenderResult } from '@testing-library/react'
import { ConnectionQuality, ConnectionState } from 'livekit-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Peca } from '../src/sala/palco'
import { useZoom } from '../src/sala/useZoom'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { Palco } from '../src/telas/Sala/Palco'
import { habilitarTelaCheia } from './apoio/navegador'
import { peca, volumesFalsos } from './apoio/pecas'

interface Cenario {
  /** O quadro em foco; `null` (com outros quadros) é a grade. */
  emDestaque?: Peca | null
  /** Os outros quadros: a pilha do foco, ou a grade inteira. */
  miniaturas?: Peca[]
  aoFocar?: (chave: string) => void
  aoAlternarImersao?: () => void
  volumes?: ControleDeVolumes
  /** A sala inteira começa com a interface visível; testar o oposto é escolha explícita do teste. */
  interfaceVisivel?: boolean
  /** A sala começa fora da imersão; entrar nela é escolha explícita do teste. */
  imersao?: boolean
  aoTentarDeNovo?: (identidade: string) => void
  minhaConexao?: ConnectionState
  minhaQualidade?: ConnectionQuality
  aoFecharEncerrada?: () => void
  aoDeixarDeVer?: (identidade: string) => void
  aoVerDeNovo?: (identidade: string) => void
}

function Palquinho({
  emDestaque = null,
  miniaturas = [],
  aoFocar = vi.fn(),
  aoAlternarImersao = vi.fn(),
  volumes = volumesFalsos(),
  interfaceVisivel = true,
  imersao = false,
  aoTentarDeNovo = vi.fn(),
  minhaConexao = ConnectionState.Connected,
  minhaQualidade,
  aoFecharEncerrada = vi.fn(),
  aoDeixarDeVer = vi.fn(),
  aoVerDeNovo = vi.fn(),
}: Cenario) {
  const zoom = useZoom(emDestaque ? [emDestaque, ...miniaturas] : miniaturas)
  return (
    <Palco
      quadros={emDestaque ? [emDestaque, ...miniaturas] : miniaturas}
      emFoco={emDestaque}
      aoFocar={aoFocar}
      aoAlternarImersao={aoAlternarImersao}
      volumes={volumes}
      interfaceVisivel={interfaceVisivel}
      imersao={imersao}
      zoom={zoom}
      aoTentarDeNovo={aoTentarDeNovo}
      minhaConexao={minhaConexao}
      minhaQualidade={minhaQualidade}
      aoFecharEncerrada={aoFecharEncerrada}
      aoDeixarDeVer={aoDeixarDeVer}
      aoVerDeNovo={aoVerDeNovo}
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
  it('a pílula da esquerda diz de quem é a tela', () => {
    montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
    expect(screen.getByText('Tela de Bia')).toBeInTheDocument()

    montarPalco({ emDestaque: peca('Ana', { ehTela: true, proprio: true }) })
    expect(screen.getByText('Sua tela')).toBeInTheDocument()
  })

  it('sem imagem nenhuma no ar, o palco diz isso em vez de desenhar um retângulo vazio', () => {
    montarPalco({ emDestaque: null })
    expect(screen.getByText('Nada no ar ainda.')).toBeInTheDocument()
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

  it('a pilha segue a interface flutuante, também na imersão', () => {
    const cenario = { emDestaque: peca('Bia', { ehTela: true }), miniaturas: [peca('Caio', { ehTela: true })], imersao: true }
    const { rerender } = render(<Palquinho {...cenario} interfaceVisivel={false} />)
    expect(screen.queryByRole('button', { name: 'Pôr a tela de Caio no palco' })).not.toBeInTheDocument()

    rerender(<Palquinho {...cenario} interfaceVisivel />)
    expect(screen.getByRole('button', { name: 'Pôr a tela de Caio no palco' })).toBeInTheDocument()
  })

  it('sem ninguém fora do destaque, não há pilha', () => {
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

describe('palco: a imersão', () => {
  it('na imersão o palco se marca — é a marca que, no CSS, tira o respiro e a moldura do quadro', () => {
    const normal = montarPalco({ emDestaque: peca('Bia', { ehTela: true }) })
    expect(normal.container.querySelector('[data-modo]')).not.toHaveAttribute('data-imersao')

    const imerso = montarPalco({ emDestaque: peca('Bia', { ehTela: true }), imersao: true })
    expect(imerso.container.querySelector('[data-modo]')).toHaveAttribute('data-imersao')
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

describe('palco: o cartão de estado do quadro', () => {
  it('a imagem que parou de chegar diz isso e oferece tentar de novo — o congelamento depois de chegar', () => {
    const aoTentarDeNovo = vi.fn()
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, recepcao: 'congelada' }), aoTentarDeNovo })

    expect(screen.getByRole('status')).toHaveTextContent('A imagem de Sadia parou de chegar aqui.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentarDeNovo).toHaveBeenCalledExactlyOnceWith('sadia')
  })

  it('a tela pausada por quem compartilha diz que está pausada, sem botão — não há o que tentar daqui', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, pausada: true }) })

    expect(screen.getByRole('status')).toHaveTextContent('A tela de Sadia está pausada')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })

  it('a própria tela pausada fala com quem compartilha', () => {
    montarPalco({ emDestaque: peca('Ana', { ehTela: true, proprio: true, pausada: true }) })
    expect(screen.getByRole('status')).toHaveTextContent('Sua tela está pausada')
  })

  it('a tela que terminou tem o Fechar', () => {
    const aoFecharEncerrada = vi.fn()
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, publicacao: undefined, encerrada: true }), aoFecharEncerrada })

    expect(screen.getByRole('status')).toHaveTextContent('A tela de Sadia terminou.')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoFecharEncerrada).toHaveBeenCalledOnce()
  })

  it('a conexão de quem compartilha caída aparece no quadro dele', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, qualidade: ConnectionQuality.Lost }) })
    expect(screen.getByRole('status')).toHaveTextContent('A conexão de Sadia caiu — esperando voltar…')
  })

  it('a minha conexão caída aparece em cima de qualquer outra coisa', () => {
    montarPalco({
      emDestaque: peca('Sadia', { ehTela: true, recepcao: 'congelada', pausada: true }),
      minhaConexao: ConnectionState.Reconnecting,
    })
    expect(screen.getByRole('status')).toHaveTextContent('Sua conexão caiu — voltando…')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })
})

describe('palco: deixar de ver a tela de alguém', () => {
  it('a pílula da tela alheia oferece deixar de ver; o quadro deixado oferece ver de novo', () => {
    const aoDeixarDeVer = vi.fn()
    const aoVerDeNovo = vi.fn()
    const { rerender } = render(<Palquinho emDestaque={peca('Sadia', { ehTela: true })} aoDeixarDeVer={aoDeixarDeVer} />)

    fireEvent.click(screen.getByRole('button', { name: 'Deixar de ver a tela de Sadia' }))
    expect(aoDeixarDeVer).toHaveBeenCalledExactlyOnceWith('sadia')

    rerender(<Palquinho emDestaque={peca('Sadia', { ehTela: true, naoVejo: true })} aoVerDeNovo={aoVerDeNovo} />)
    expect(screen.getByRole('status')).toHaveTextContent('Você deixou de ver a tela de Sadia.')
    fireEvent.click(screen.getByRole('button', { name: 'Ver de novo' }))
    expect(aoVerDeNovo).toHaveBeenCalledExactlyOnceWith('sadia')
  })

  it('a própria tela não tem "deixar de ver"', () => {
    montarPalco({ emDestaque: peca('Ana', { ehTela: true, proprio: true }) })
    expect(screen.queryByRole('button', { name: /Deixar de ver/ })).not.toBeInTheDocument()
  })
})

describe('palco: o aviso de qualidade diz de quem é a rede', () => {
  it('a minha rede fraca aparece só depois do aquecimento, sem cobrir a imagem com cartão', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true }), minhaQualidade: ConnectionQuality.Poor })
    expect(screen.queryByText(/conexão está fraca/)).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(10_000))

    expect(screen.getByRole('status')).toHaveTextContent('Sua conexão está fraca — a imagem pode travar aqui.')
  })

  it('a qualidade que o SFU anuncia sobre o dono não vira aviso — ela não mede a rede dele', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, qualidade: ConnectionQuality.Poor }) })
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByText(/conexão de Sadia está fraca/)).not.toBeInTheDocument()
  })

  it('a rede fraca de quem compartilha (pelo pulso dela) leva o nome dela', () => {
    montarPalco({ emDestaque: peca('Sadia', { ehTela: true, redeFraca: true }) })
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByRole('status')).toHaveTextContent('A conexão de Sadia está fraca')
  })

  it('com cartão de estado, o cartão explica sozinho', () => {
    montarPalco({
      emDestaque: peca('Sadia', { ehTela: true, pausada: true }),
      minhaQualidade: ConnectionQuality.Poor,
    })
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByText(/conexão está fraca/)).not.toBeInTheDocument()
  })

  it('na própria tela não há aviso de quem assiste', () => {
    montarPalco({ emDestaque: peca('Ana', { ehTela: true, proprio: true }), minhaQualidade: ConnectionQuality.Poor })
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByText(/conexão está fraca/)).not.toBeInTheDocument()
  })
})
