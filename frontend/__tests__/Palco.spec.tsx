import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Peca } from '../src/sala/palco'
import type { ControleDeVolumes } from '../src/sala/useVolumes'
import { volumeDe, type Volumes } from '../src/sala/volumes'
import { Palco } from '../src/telas/Sala/Palco'

function peca(nome: string, parcial: Partial<Peca> = {}): Peca {
  const ehTela = parcial.ehTela ?? false
  return {
    chave: `${ehTela ? 'tela' : 'pessoa'}:${nome}`,
    identidade: nome.toLowerCase(),
    nome,
    ehTela,
    proprio: false,
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
}: {
  telas?: Peca[]
  pessoas?: Peca[]
  volumes?: ControleDeVolumes
} = {}) {
  render(<Palco palco={{ telas, pessoas }} fixada={null} aoFixar={vi.fn()} volumes={volumes} />)
  return volumes
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
    const volumes = montarGrade({
      telas: [peca('Bia', { ehTela: true })],
      pessoas: [peca('Bia')],
      volumes: volumesFalsos({ Bia: { pessoa: 40, tela: 70 } }),
    })

    const daVoz = screen.getByRole('slider', { name: 'Volume de Bia' })
    const daTela = screen.getByRole('slider', { name: 'Volume da tela de Bia' })
    expect(daVoz).toHaveValue('40')
    expect(daTela).toHaveValue('70')

    fireEvent.change(daTela, { target: { value: '71' } })
    expect(volumes.definir).toHaveBeenLastCalledWith('Bia', 'tela', 71)
  })

  it('o mudo do quadro é o do nome e da fonte daquele quadro', async () => {
    const usuario = userEvent.setup()
    const volumes = montarGrade({
      telas: [peca('Bia', { ehTela: true })],
      volumes: volumesFalsos({ Bia: { tela: 0 } }),
    })

    const botao = screen.getByRole('button', { name: 'Devolver o som da tela de Bia' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(botao)
    expect(volumes.alternarMudo).toHaveBeenCalledWith('Bia', 'tela')
  })
})
