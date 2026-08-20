import { act, cleanup, fireEvent, render, screen, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Track, type TrackPublication } from 'livekit-client'
import type { Peca } from '../src/sala/palco'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { volumeDe, type Volumes } from '../src/sala/volumes'
import type { Ajuste } from '../src/telas/Sala/assistir'
import { Palco } from '../src/telas/Sala/Palco'
import { habilitarPiP, habilitarTelaCheia } from './apoio/navegador'
import { publicacaoFalsa } from './apoio/salaFalsa'

function peca(nome: string, parcial: Partial<Peca> = {}): Peca {
  const ehTela = parcial.ehTela ?? false
  return {
    chave: `${ehTela ? 'tela' : 'pessoa'}:${nome}`,
    identidade: nome.toLowerCase(),
    nome,
    ehTela,
    proprio: false,
    // Uma tela no palco sempre tem publicação — é o que a põe lá.
    publicacao: ehTela ? (publicacaoFalsa(Track.Source.ScreenShare) as unknown as TrackPublication) : undefined,
    microfoneLigado: true,
    falando: false,
    temAudio: true,
    ...parcial,
  }
}

function volumesFalsos(guardados: Volumes = {}): ControleDeVolumes {
  return {
    volumeDe: (nome, tipo) => volumeDe(guardados, nome, tipo),
    definir: vi.fn(),
    alternarMudo: vi.fn(),
  }
}

function montarGrade({
  telas = [],
  pessoas = [],
  volumes = volumesFalsos(),
  ajuste = 'caber',
  aoAjustar = vi.fn(),
  aoFixar = vi.fn(),
}: {
  telas?: Peca[]
  pessoas?: Peca[]
  volumes?: ControleDeVolumes
  ajuste?: Ajuste
  aoAjustar?: (ajuste: Ajuste) => void
  aoFixar?: (chave: string | null) => void
} = {}) {
  return render(
    <Palco
      palco={{ telas, pessoas }}
      fixada={null}
      aoFixar={aoFixar}
      volumes={volumes}
      ajuste={ajuste}
      aoAjustar={aoAjustar}
    />,
  )
}

describe('quadro: volume local de quem assiste', () => {
  it('nos próprios quadros não há volume — ninguém regula o som que ele mesmo manda', () => {
    montarGrade({
      telas: [peca('Ana', { ehTela: true, proprio: true })],
      pessoas: [peca('Ana', { proprio: true })],
    })

    expect(screen.queryByRole('slider', { name: /volume/i })).not.toBeInTheDocument()
  })

  it('sem áudio publicado não há o que regular', () => {
    montarGrade({ pessoas: [peca('Bia', { temAudio: false })] })
    expect(screen.queryByRole('slider', { name: /volume/i })).not.toBeInTheDocument()
  })

  it('a voz e a tela do mesmo nome têm cada uma o seu volume', () => {
    const volumes = volumesFalsos({ Bia: { pessoa: 40, tela: 70 } })
    montarGrade({ telas: [peca('Bia', { ehTela: true })], pessoas: [peca('Bia')], volumes })

    const daVoz = screen.getByRole('slider', { name: 'Volume de Bia' })
    const daTela = screen.getByRole('slider', { name: 'Volume da tela de Bia' })
    expect(daVoz).toHaveValue('40')
    expect(daTela).toHaveValue('70')

    fireEvent.change(daTela, { target: { value: '71' } })
    expect(volumes.definir).toHaveBeenLastCalledWith('Bia', 'tela', 71)
  })

  it('o mudo do quadro é o do nome e da fonte daquele quadro', async () => {
    const usuario = userEvent.setup()
    const volumes = volumesFalsos({ Bia: { tela: 0 } })
    montarGrade({ telas: [peca('Bia', { ehTela: true })], volumes })

    const botao = screen.getByRole('button', { name: 'Devolver o som da tela de Bia' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(botao)
    expect(volumes.alternarMudo).toHaveBeenCalledWith('Bia', 'tela')
  })
})

/** O quadro não tem papel de ARIA; é a marca de tela que o identifica na árvore. */
function quadroDaTela(resultado: RenderResult): HTMLElement {
  return resultado.container.querySelector('[data-tela]') as HTMLElement
}

/** A moldura é a área do vídeo: onde o duplo clique e o arraste acontecem. */
function molduraDaTela(resultado: RenderResult): HTMLElement {
  return resultado.container.querySelector('[data-ajuste]') as HTMLElement
}

describe('quadro de tela: assistir melhor', () => {
  it('sem suporte do navegador, os botões de tela cheia e de PiP não aparecem', () => {
    montarGrade({ telas: [peca('Bia', { ehTela: true })] })

    expect(screen.queryByRole('button', { name: /tela cheia/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /janelinha/i })).not.toBeInTheDocument()
    // O ajuste é só CSS: existe em qualquer navegador.
    expect(screen.getByRole('button', { name: /pixel a pixel/i })).toBeInTheDocument()
  })

  it('o botão põe o quadro inteiro em tela cheia — etiqueta e controles vão junto — e o Esc devolve', async () => {
    const usuario = userEvent.setup()
    const telaCheia = habilitarTelaCheia()
    const resultado = montarGrade({ telas: [peca('Bia', { ehTela: true })] })

    await usuario.click(screen.getByRole('button', { name: 'Ver em tela cheia' }))

    expect(telaCheia.atual).toBe(quadroDaTela(resultado))
    expect(telaCheia.atual).toContainElement(screen.getByText(/Bia/))
    expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toBeInTheDocument()

    act(() => telaCheia.sair())
    expect(screen.getByRole('button', { name: 'Ver em tela cheia' })).toBeInTheDocument()
  })

  it('o duplo clique na tela faz o mesmo que o botão', async () => {
    const usuario = userEvent.setup()
    const telaCheia = habilitarTelaCheia()
    const resultado = montarGrade({ telas: [peca('Bia', { ehTela: true })] })

    await usuario.dblClick(molduraDaTela(resultado))

    expect(telaCheia.atual).toBe(quadroDaTela(resultado))
  })

  it('duplo clique não fixa: fixar continua sendo coisa do botão', async () => {
    const usuario = userEvent.setup()
    habilitarTelaCheia()
    const aoFixar = vi.fn()
    const resultado = montarGrade({ telas: [peca('Bia', { ehTela: true })], aoFixar })

    await usuario.dblClick(molduraDaTela(resultado))
    expect(aoFixar).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'Fixar em foco' }))
    expect(aoFixar).toHaveBeenCalledWith('tela:Bia')
  })

  it('o PiP manda o vídeo para a janelinha e o quadro avisa enquanto ele está lá', async () => {
    const usuario = userEvent.setup()
    const pip = habilitarPiP()
    montarGrade({ telas: [peca('Bia', { ehTela: true })] })

    await usuario.click(screen.getByRole('button', { name: 'Ver na janelinha' }))

    expect(pip.atual?.tagName).toBe('VIDEO')
    expect(screen.getByText('em PiP')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Trazer da janelinha' }))
    expect(pip.atual).toBeNull()
    expect(screen.queryByText('em PiP')).not.toBeInTheDocument()
  })

  it('o ajuste escolhido é o que a moldura mostra, e o botão pede a troca', async () => {
    const usuario = userEvent.setup()
    const aoAjustar = vi.fn()
    const resultado = montarGrade({ telas: [peca('Bia', { ehTela: true })], ajuste: 'caber', aoAjustar })
    expect(molduraDaTela(resultado)).toHaveAttribute('data-ajuste', 'caber')

    await usuario.click(screen.getByRole('button', { name: /pixel a pixel/i }))
    expect(aoAjustar).toHaveBeenCalledWith('pixelAPixel')

    const emPixel = montarGrade({ telas: [peca('Caio', { ehTela: true })], ajuste: 'pixelAPixel' })
    expect(molduraDaTela(emPixel)).toHaveAttribute('data-ajuste', 'pixelAPixel')
  })

  it('em pixel a pixel, arrastar anda pela tela; em caber, não há para onde andar', () => {
    const emPixel = molduraDaTela(montarGrade({ telas: [peca('Bia', { ehTela: true })], ajuste: 'pixelAPixel' }))

    fireEvent.pointerDown(emPixel, { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(emPixel, { pointerId: 1, clientX: 260, clientY: 170 })
    expect(emPixel.scrollLeft).toBe(40)
    expect(emPixel.scrollTop).toBe(30)

    fireEvent.pointerUp(emPixel, { pointerId: 1, clientX: 260, clientY: 170 })
    fireEvent.pointerMove(emPixel, { pointerId: 1, clientX: 100, clientY: 100 })
    expect(emPixel.scrollLeft).toBe(40)

    cleanup()
    const cabendo = molduraDaTela(montarGrade({ telas: [peca('Bia', { ehTela: true })], ajuste: 'caber' }))
    fireEvent.pointerDown(cabendo, { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(cabendo, { pointerId: 1, clientX: 260, clientY: 170 })
    expect(cabendo.scrollLeft).toBe(0)
  })
})
