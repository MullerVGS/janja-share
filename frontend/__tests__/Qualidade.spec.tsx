import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GOVERNADOR_PARADO } from '../src/sala/governador'
import { PERFIL_PADRAO, PRESET_DO_CONTEUDO, type PerfilDeQualidade, type RelatorioDeAplicacao } from '../src/sala/qualidade'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { Qualidade } from '../src/telas/Sala/Qualidade'

function compartilhamentoFalso(parcial: Partial<Compartilhamento> = {}): Compartilhamento {
  const perfil = parcial.perfil ?? PERFIL_PADRAO
  return {
    ativo: true,
    perfil,
    definirPerfil: vi.fn(),
    perfilEfetivo: perfil,
    automatico: true,
    definirAutomatico: vi.fn(),
    governador: GOVERNADOR_PARADO,
    relatorio: null,
    codecPendente: null,
    erro: null,
    ocupado: false,
    alternar: vi.fn(async () => {}),
    reiniciar: vi.fn(async () => {}),
    ...parcial,
  }
}

function montarQualidade(parcial: Partial<Compartilhamento> = {}) {
  const compartilhamento = compartilhamentoFalso(parcial)
  render(<Qualidade compartilhamento={compartilhamento} />)
  return compartilhamento
}

describe('aba Qualidade: controles', () => {
  it('mostra os dois eixos, o codec, resolução, fps e teto com o perfil atual marcado', () => {
    montarQualidade({ perfil: { ...PRESET_DO_CONTEUDO.movimento, resolucao: '720p' } })

    expect(screen.getByRole('radio', { name: 'Movimento' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'H.264' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '720p' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '60' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Resolução' })).toBeChecked()
    expect(screen.getByRole('slider', { name: /teto/i })).toHaveValue('8000')
  })

  it('trocar o conteúdo aplica o preset e preserva a resolução escolhida', async () => {
    const usuario = userEvent.setup()
    const escolhido: PerfilDeQualidade[] = []
    montarQualidade({
      perfil: { ...PRESET_DO_CONTEUDO.texto, resolucao: '720p' },
      definirPerfil: (perfil) => escolhido.push(perfil),
    })

    await usuario.click(screen.getByRole('radio', { name: 'Movimento' }))

    expect(escolhido[0]).toEqual({ ...PRESET_DO_CONTEUDO.movimento, resolucao: '720p' })
  })

  it('codec, ceder, resolução e fps mudam só o próprio campo', async () => {
    const usuario = userEvent.setup()
    const escolhido: PerfilDeQualidade[] = []
    montarQualidade({ definirPerfil: (perfil) => escolhido.push(perfil) })

    await usuario.click(screen.getByRole('radio', { name: 'AV1' }))
    await usuario.click(screen.getByRole('radio', { name: 'Resolução' }))
    await usuario.click(screen.getByRole('radio', { name: '540p' }))
    await usuario.click(screen.getByRole('radio', { name: '30' }))

    expect(escolhido).toEqual([
      { ...PERFIL_PADRAO, codec: 'av1' },
      { ...PERFIL_PADRAO, ceder: 'resolucao' },
      { ...PERFIL_PADRAO, resolucao: '540p' },
      { ...PERFIL_PADRAO, fps: 30 },
    ])
  })

  it('o slider de teto vai de 200 a 20 000 kbps', () => {
    montarQualidade()
    const slider = screen.getByRole('slider', { name: /teto/i })
    expect(slider).toHaveAttribute('min', '200')
    expect(slider).toHaveAttribute('max', '20000')
  })

  it('explica o codec escolhido numa linha', () => {
    montarQualidade({ perfil: { ...PERFIL_PADRAO, codec: 'h264' } })
    expect(screen.getByText(/encoder de hardware/)).toBeInTheDocument()
  })

  it('sem transmissão, avisa que vale no próximo compartilhamento', () => {
    montarQualidade({ ativo: false })
    expect(screen.getByText(/vale no próximo compartilhamento/)).toBeInTheDocument()
  })
})

describe('aba Qualidade: recusas', () => {
  it('cala a boca quando o ajuste pega nas duas metades', () => {
    montarQualidade({ relatorio: { captura: 'aplicado', encoder: 'aplicado' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/recusou/)).not.toBeInTheDocument()
  })

  it('conta que a captura recusou, dizendo que teto e eixos seguem valendo', () => {
    const relatorio: RelatorioDeAplicacao = {
      captura: 'recusado',
      encoder: 'aplicado',
      falhaDaCaptura: 'OverconstrainedError: frameRate',
    }
    montarQualidade({ relatorio })

    expect(screen.getByText(/A captura recusou este ajuste/)).toHaveTextContent('OverconstrainedError: frameRate')
  })

  /**
   * Recusa do encoder é o caso que mente: o slider já mostra o valor novo, mas o que está no ar
   * continua sendo o anterior. Sem aviso, a pessoa acha que ajustou.
   */
  it('avisa em alerta quando o encoder recusa, e diz que o ar continua no valor anterior', () => {
    const relatorio: RelatorioDeAplicacao = {
      captura: 'aplicado',
      encoder: 'recusado',
      falhaDoEncoder: 'InvalidStateError: parameters are outdated',
    }
    montarQualidade({ relatorio })

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('O encoder recusou este ajuste')
    expect(alerta).toHaveTextContent('InvalidStateError: parameters are outdated')
    expect(alerta).toHaveTextContent(/ainda são os anteriores/)
  })

  it('as duas recusas juntas aparecem com a mensagem de cada metade, sem trocar uma pela outra', () => {
    const relatorio: RelatorioDeAplicacao = {
      captura: 'recusado',
      encoder: 'recusado',
      falhaDaCaptura: 'falha da captura',
      falhaDoEncoder: 'falha do encoder',
    }
    montarQualidade({ relatorio })

    expect(screen.getByText(/A captura recusou/)).toHaveTextContent('falha da captura')
    expect(screen.getByText(/O encoder recusou/)).toHaveTextContent('falha do encoder')
  })
})
