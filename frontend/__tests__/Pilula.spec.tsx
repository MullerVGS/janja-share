import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pilula } from '../src/telas/Sala/Pilula'
import { habilitarPiP, habilitarTelaCheia } from './apoio/navegador'
import { peca, volumesFalsos } from './apoio/pecas'

type Props = Parameters<typeof Pilula>[0]

function montarPilula(parcial: Partial<Props> = {}) {
  const props: Props = {
    peca: peca('Bia', { ehTela: true }),
    volumes: volumesFalsos(),
    zoom: { caber: vi.fn(), umPorUm: vi.fn() },
    telaCheia: { cheia: false, alternar: vi.fn() },
    pip: { emPiP: false, alternar: vi.fn() },
    ...parcial,
  }
  return { ...props, ...render(<Pilula {...props} />) }
}

const rotulos = () => screen.getAllByRole('button').map((botao) => botao.getAttribute('aria-label'))

describe('pílula: os botões saem do papel de quem vê', () => {
  it('na sua tela: só caber e 1:1 — trocar, parar e o áudio dela moram na barra', () => {
    montarPilula({ peca: peca('Ana', { ehTela: true, proprio: true }) })

    expect(rotulos()).toEqual(['Fazer a tela caber no quadro', 'Ver em 1:1'])
    // O seu próprio som não tem volume local: você não se ouve.
    expect(screen.queryByRole('slider', { name: /volume/i })).not.toBeInTheDocument()
  })

  it('na tela de outra pessoa: o som dela, caber, 1:1, janelinha e tela cheia', () => {
    habilitarPiP()
    habilitarTelaCheia()
    montarPilula({ peca: peca('Bia', { ehTela: true }) })

    expect(rotulos()).toEqual([
      'Calar o som da tela de Bia',
      'Fazer a tela caber no quadro',
      'Ver em 1:1',
      'Ver na janelinha',
      'Ver em tela cheia',
    ])
    expect(screen.getByRole('slider', { name: 'Volume do som da tela de Bia' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /parar|trocar/i })).not.toBeInTheDocument()
  })

  it('na câmera de outra pessoa: a voz dela e como assistir — zoom é coisa de tela', () => {
    habilitarPiP()
    habilitarTelaCheia()
    montarPilula({ peca: peca('Bia') })

    expect(rotulos()).toEqual(['Calar a voz de Bia', 'Ver na janelinha', 'Ver em tela cheia'])
  })

  it('na sua própria câmera não há pílula nenhuma: nem volume do seu som, nem nada a apertar', () => {
    habilitarPiP()
    habilitarTelaCheia()
    const { container } = montarPilula({ peca: peca('Ana', { proprio: true }) })
    expect(container).toBeEmptyDOMElement()
  })

  it('ninguém vê fixar: fixar é o clique', () => {
    habilitarTelaCheia()
    montarPilula({ peca: peca('Bia', { ehTela: true }) })
    expect(screen.queryByRole('button', { name: /fixar|foco/i })).not.toBeInTheDocument()
  })

  it('sem suporte do navegador, janelinha e tela cheia não aparecem', () => {
    montarPilula({ peca: peca('Bia', { ehTela: true }) })
    expect(screen.queryByRole('button', { name: /janelinha/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tela cheia/i })).not.toBeInTheDocument()
  })
})

describe('pílula: o que cada botão faz', () => {
  it('caber e 1:1 falam com o zoom daquela peça', async () => {
    const usuario = userEvent.setup()
    const { zoom } = montarPilula({ peca: peca('Bia', { ehTela: true }) })

    await usuario.click(screen.getByRole('button', { name: 'Fazer a tela caber no quadro' }))
    await usuario.click(screen.getByRole('button', { name: 'Ver em 1:1' }))

    expect(zoom.caber).toHaveBeenCalledOnce()
    expect(zoom.umPorUm).toHaveBeenCalledOnce()
  })

  it('o volume cala e devolve pelo tipo daquela peça', async () => {
    const usuario = userEvent.setup()
    const { volumes } = montarPilula({ peca: peca('Bia', { ehTela: true }) })

    await usuario.click(screen.getByRole('button', { name: 'Calar o som da tela de Bia' }))
    expect(volumes.alternarMudo).toHaveBeenCalledExactlyOnceWith('Bia', 'tela')
  })

  it('a janelinha e a tela cheia se anunciam pelo estado em que estão', () => {
    habilitarPiP()
    habilitarTelaCheia()
    montarPilula({
      peca: peca('Bia', { ehTela: true }),
      telaCheia: { cheia: true, alternar: vi.fn() },
      pip: { emPiP: true, alternar: vi.fn() },
    })

    expect(screen.getByRole('button', { name: 'Trazer da janelinha' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toHaveAttribute('aria-pressed', 'true')
  })
})
