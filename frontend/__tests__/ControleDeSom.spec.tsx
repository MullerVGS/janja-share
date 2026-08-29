import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Peca } from '../src/sala/palco'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { ControleDeSom } from '../src/telas/Sala/ControleDeSom'
import { habilitarWebAudio } from './apoio/navegador'

const VOLUMES: ControleDeVolumes = { volumeDe: () => 100, definir: vi.fn(), alternarMudo: vi.fn() }

const PESSOA: Peca = {
  chave: 'pessoa:sadia-1', identidade: 'sadia-1', nome: 'Sadia', ehTela: false, proprio: false,
  microfoneLigado: true, falando: false, temAudio: true,
}
const TELA: Peca = { ...PESSOA, chave: 'tela:sadia-1', ehTela: true, microfoneLigado: false }

describe('controle de som: voz e tela não se confundem', () => {
  it('no quadro da pessoa fala em voz', () => {
    render(<ControleDeSom peca={PESSOA} volumes={VOLUMES} />)
    expect(screen.getByRole('button', { name: 'Calar a voz de Sadia' })).toBeTruthy()
    expect(screen.getByLabelText('Volume da voz de Sadia')).toBeTruthy()
  })

  it('no quadro da tela fala no som da tela', () => {
    render(<ControleDeSom peca={TELA} volumes={VOLUMES} />)
    expect(screen.getByRole('button', { name: 'Calar o som da tela de Sadia' })).toBeTruthy()
  })

  it('microfone fechado apaga o controle da voz sem escondê-lo', () => {
    render(<ControleDeSom peca={{ ...PESSOA, microfoneLigado: false }} volumes={VOLUMES} />)
    const botao = screen.getByRole('button', { name: 'Calar a voz de Sadia' })
    expect(botao.getAttribute('disabled')).not.toBeNull()
    expect(botao.getAttribute('title')).toBe('microfone fechado')
  })

  it('volume em zero se anuncia como mudo', () => {
    render(<ControleDeSom peca={TELA} volumes={{ ...VOLUMES, volumeDe: () => 0 }} />)
    expect(screen.getByRole('button', { name: 'Devolver o som da tela de Sadia' })).toBeTruthy()
  })
})

/**
 * `publicacaoDoAudio` é vídeo de mentira nestes testes: só interessa que a faixa certa chegue
 * ao indicador, não o que o WebAudio faz com ela — isso já é coberto em `SomSaindo.spec.tsx`.
 */
describe('controle de som: o indicador de nível é da publicação de áudio da tela', () => {
  it('na tela, o indicador liga na faixa de `publicacaoDoAudio`, não na de `publicacao`', () => {
    const webAudio = habilitarWebAudio()
    const faixa = { id: 'som-da-tela' } as unknown as MediaStreamTrack
    const comAudio: Peca = {
      ...TELA,
      publicacaoDoAudio: { track: { mediaStreamTrack: faixa } } as unknown as Peca['publicacaoDoAudio'],
    }

    render(<ControleDeSom peca={comAudio} volumes={VOLUMES} />)

    expect(screen.getByTitle('som saindo')).toBeInTheDocument()
    expect(webAudio.faixas).toEqual([faixa])
  })

  it('sem publicação de áudio o indicador não aparece', () => {
    habilitarWebAudio()
    render(<ControleDeSom peca={TELA} volumes={VOLUMES} />)
    expect(screen.queryByTitle('som saindo')).not.toBeInTheDocument()
  })

  it('na voz o indicador não aparece — o nível da fala já se anuncia pela moldura de quem fala', () => {
    habilitarWebAudio()
    const comAudio: Peca = {
      ...PESSOA,
      publicacaoDoAudio: { track: { mediaStreamTrack: { id: 'voz' } } } as unknown as Peca['publicacaoDoAudio'],
    }

    render(<ControleDeSom peca={comAudio} volumes={VOLUMES} />)

    expect(screen.queryByTitle('som saindo')).not.toBeInTheDocument()
  })
})
