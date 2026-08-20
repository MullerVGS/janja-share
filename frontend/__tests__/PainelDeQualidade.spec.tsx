import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MEDIDA_VAZIA } from '../src/sala/medidor'
import { PERFIL_PADRAO, PRESETS, type PerfilDeQualidade, type RelatorioDeAplicacao } from '../src/sala/qualidade'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { PainelDeQualidade } from '../src/telas/Sala/PainelDeQualidade'

function compartilhamentoFalso(parcial: Partial<Compartilhamento> = {}): Compartilhamento {
  return {
    ativo: true,
    perfil: PERFIL_PADRAO,
    definirPerfil: vi.fn(),
    medida: MEDIDA_VAZIA,
    relatorio: null,
    erro: null,
    ocupado: false,
    alternar: vi.fn(async () => {}),
    ...parcial,
  }
}

function montarPainel(parcial: Partial<Compartilhamento> = {}) {
  const compartilhamento = compartilhamentoFalso(parcial)
  render(<PainelDeQualidade compartilhamento={compartilhamento} />)
  return compartilhamento
}

describe('painel de qualidade', () => {
  it('cala a boca quando o ajuste pega nas duas metades', () => {
    montarPainel({ relatorio: { captura: 'aplicado', encoder: 'aplicado' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/recusou/)).not.toBeInTheDocument()
  })

  it('conta que a captura recusou, dizendo que teto e prioridade seguem valendo', () => {
    const relatorio: RelatorioDeAplicacao = {
      captura: 'recusado',
      encoder: 'aplicado',
      falhaDaCaptura: 'OverconstrainedError: frameRate',
    }
    montarPainel({ relatorio })

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
    montarPainel({ relatorio })

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
    montarPainel({ relatorio })

    expect(screen.getByText(/A captura recusou/)).toHaveTextContent('falha da captura')
    expect(screen.getByText(/O encoder recusou/)).toHaveTextContent('falha do encoder')
  })

  it('trocar para Fluidez aplica o preset e preserva a resolução escolhida', async () => {
    const usuario = userEvent.setup()
    const escolhido: PerfilDeQualidade[] = []
    montarPainel({
      perfil: { ...PRESETS.nitidez, resolucao: '720p' },
      definirPerfil: (perfil) => escolhido.push(perfil),
    })

    await usuario.click(screen.getByRole('radio', { name: 'Fluidez' }))

    expect(escolhido[0]).toEqual({ resolucao: '720p', fps: 30, prioridade: 'fluidez', tetoKbps: 4000 })
  })
})
