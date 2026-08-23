import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Peca } from '../src/sala/palco'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { ControleDeSom } from '../src/telas/Sala/ControleDeSom'

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
