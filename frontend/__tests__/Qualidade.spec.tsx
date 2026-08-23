import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GOVERNADOR_PARADO, type EstadoDoGovernador } from '../src/sala/governador'
import { PERFIL_PADRAO, PRESET_DO_CONTEUDO, type PerfilDeQualidade, type RelatorioDeAplicacao } from '../src/sala/qualidade'
import type { Compartilhamento } from '../src/sala/useCompartilhamento'
import { Qualidade } from '../src/telas/Sala/Qualidade'
import { compartilhamentoFalso } from './apoio/compartilhamentoFalso'

function montarQualidade(parcial: Partial<Compartilhamento> = {}) {
  const compartilhamento = compartilhamentoFalso({ ativo: true, ...parcial })
  render(<Qualidade compartilhamento={compartilhamento} />)
  return compartilhamento
}

describe('aba Qualidade: os dois botões', () => {
  it('a escolha da pessoa é uma só: o que está na tela', () => {
    montarQualidade()
    const conteudo = screen.getByRole('radiogroup', { name: 'Conteúdo' })
    expect(within(conteudo).getAllByRole('radio').map((botao) => botao.textContent)).toEqual(['Texto', 'Jogo'])
  })

  it('Avançado começa fechado: o painel de antes existe, mas não é o produto', () => {
    montarQualidade()
    expect(screen.getByText('Avançado').closest('details')).not.toHaveAttribute('open')
  })
})

describe('aba Qualidade: controles', () => {
  it('mostra os dois eixos, o codec, resolução, fps e bitrate com o perfil atual marcado', () => {
    montarQualidade({ perfil: { ...PRESET_DO_CONTEUDO.jogo, resolucao: '720p' } })

    expect(screen.getByRole('radio', { name: 'Jogo' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'H.264' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '720p' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '60' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Resolução' })).toBeChecked()
    expect(screen.getByRole('slider', { name: /bitrate/i })).toHaveValue('8000')
  })

  it('trocar o conteúdo aplica o preset e preserva a resolução escolhida', async () => {
    const usuario = userEvent.setup()
    const escolhido: PerfilDeQualidade[] = []
    montarQualidade({
      perfil: { ...PRESET_DO_CONTEUDO.texto, resolucao: '720p' },
      definirPerfil: (perfil) => escolhido.push(perfil),
    })

    await usuario.click(screen.getByRole('radio', { name: 'Jogo' }))

    expect(escolhido[0]).toEqual({ ...PRESET_DO_CONTEUDO.jogo, resolucao: '720p' })
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

  it('cada grupo de controles tem o nome que se lê — inclusive o que tem espaço e vírgula', () => {
    montarQualidade()
    for (const nome of ['Conteúdo', 'Codec', 'Resolução', 'FPS', 'Sob aperto, ceder']) {
      expect(screen.getByRole('radiogroup', { name: nome })).toBeInTheDocument()
    }
  })

  it('o slider de bitrate vai de 200 a 50 000 kbps — é a partida, e o topo é o da busca', () => {
    montarQualidade()
    const slider = screen.getByRole('slider', { name: /bitrate/i })
    expect(slider).toHaveAttribute('min', '200')
    expect(slider).toHaveAttribute('max', '50000')
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

describe('aba Qualidade: automático', () => {
  const SEGURANDO: EstadoDoGovernador = { ...GOVERNADOR_PARADO, degrau: 30, motivo: 'cpu' }

  it('a chave Automático reflete a preferência e a alterna', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = montarQualidade({ automatico: true })
    const chave = screen.getByRole('switch', { name: /automático/i })
    expect(chave).toBeChecked()

    await usuario.click(chave)
    expect(compartilhamento.definirAutomatico).toHaveBeenCalledWith(false)
  })

  it('com degrau em vigor conta o que está no ar, para onde cedeu e por quê; "forçar" desliga o automático', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = montarQualidade({
      perfil: { ...PERFIL_PADRAO, fps: 60 },
      perfilEfetivo: { ...PERFIL_PADRAO, fps: 30 },
      governador: SEGURANDO,
    })

    const estado = screen.getByRole('status', { name: /governador/i })
    expect(estado).toHaveTextContent('4,0 Mb/s · 1080p · 30 fps · cedeu para 30 fps — CPU')

    await usuario.click(screen.getByRole('button', { name: /forçar/i }))
    expect(compartilhamento.definirAutomatico).toHaveBeenCalledWith(false)
  })

  it('sem nada decidido ainda, a linha diz o que está no ar e que é o ponto de partida', () => {
    montarQualidade({ automatico: true })
    const estado = screen.getByRole('status', { name: /governador/i })
    expect(estado).toHaveTextContent('4,0 Mb/s · 1080p · 15 fps · no ponto de partida')
    expect(screen.queryByRole('button', { name: /forçar/i })).not.toBeInTheDocument()
  })

  it('com o teto acima da partida, a linha mostra o teto conquistado e diz que está subindo', () => {
    const subindo: EstadoDoGovernador = { ...GOVERNADOR_PARADO, tetoKbps: 12_500 }
    montarQualidade({ perfilEfetivo: { ...PERFIL_PADRAO, tetoKbps: 12_500 }, governador: subindo })
    expect(screen.getByRole('status', { name: /governador/i })).toHaveTextContent('12,5 Mb/s · 1080p · 15 fps · subindo')
  })

  /** "Subindo" é postura, não promessa: no teto do link não há próxima janela limpa que renda nada. */
  it('com a busca no que a banda deixa, para de dizer "subindo"', () => {
    const noAlvo: EstadoDoGovernador = { ...GOVERNADOR_PARADO, tetoKbps: 12_500, tetoNoAlvo: true }
    montarQualidade({ perfilEfetivo: { ...PERFIL_PADRAO, tetoKbps: 12_500 }, governador: noAlvo })
    expect(screen.getByRole('status', { name: /governador/i })).toHaveTextContent('12,5 Mb/s · 1080p · 15 fps · no teto do link')
  })

  it('no teto do link sem nunca ter subido (a partida já era o que o link dá) também não diz "subindo"', () => {
    const noAlvo: EstadoDoGovernador = { ...GOVERNADOR_PARADO, tetoNoAlvo: true }
    montarQualidade({ governador: noAlvo })
    expect(screen.getByRole('status', { name: /governador/i })).toHaveTextContent('no teto do link')
  })

  it('teto cedido sem degrau nenhum aparece como cessão de teto, não como subida', () => {
    const cedeu: EstadoDoGovernador = { ...GOVERNADOR_PARADO, tetoKbps: 2_400, motivo: 'banda' }
    montarQualidade({ perfilEfetivo: { ...PERFIL_PADRAO, tetoKbps: 2_400 }, governador: cedeu })
    expect(screen.getByRole('status', { name: /governador/i })).toHaveTextContent('2,4 Mb/s · 1080p · 15 fps · cedeu o teto — banda')
    expect(screen.queryByRole('button', { name: /forçar/i })).not.toBeInTheDocument()
  })

  /**
   * "forçar" desliga o automático num clique e grava a escolha. Se a linha de status sumisse
   * junto, o que sobraria era uma transmissão sem indicador nenhum e a única chave de religar
   * escondida dentro do `<details>` "Avançado", fechado por padrão: saída de um clique, volta
   * de três, e nenhum sinal de que o produto da branch está desligado.
   */
  it('desligado, a linha continua no ar dizendo isso — e religar está junto dela, não escondido no Avançado', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = montarQualidade({ automatico: false, governador: SEGURANDO })

    const estado = screen.getByRole('status', { name: /governador/i })
    expect(estado).toHaveTextContent('4,0 Mb/s · 1080p · 15 fps · automático desligado')
    expect(screen.queryByRole('button', { name: /forçar/i })).not.toBeInTheDocument()

    // O caminho de volta não pode depender de abrir o Avançado.
    expect(screen.getByText('Avançado').closest('details')).not.toHaveAttribute('open')
    await usuario.click(within(estado).getByRole('button', { name: /religar/i }))

    expect(compartilhamento.definirAutomatico).toHaveBeenCalledWith(true)
  })

  /** Desligado, o degrau em vigor não existe mais (definirAutomatico zera o governador): a linha não pode narrar cessão. */
  it('desligado, a linha conta o pedido que está no ar — não o que o governador tinha decidido', () => {
    montarQualidade({
      automatico: false,
      perfil: { ...PERFIL_PADRAO, fps: 60 },
      perfilEfetivo: { ...PERFIL_PADRAO, fps: 60 },
      governador: SEGURANDO,
    })
    const estado = screen.getByRole('status', { name: /governador/i })
    expect(estado).toHaveTextContent('60 fps')
    expect(estado).not.toHaveTextContent(/cedeu/)
  })
})

describe('aba Qualidade: codec pendente', () => {
  it('quando o codec não entrou no ar, avisa que vale no próximo compartilhamento e oferece Reiniciar', async () => {
    const usuario = userEvent.setup()
    const compartilhamento = montarQualidade({ perfil: { ...PERFIL_PADRAO, codec: 'av1' }, codecPendente: 'av1' })

    expect(screen.getByText(/não entrou no ar/)).toHaveTextContent('AV1 não entrou no ar: vale no próximo compartilhamento.')

    await usuario.click(screen.getByRole('button', { name: 'Reiniciar transmissão' }))
    expect(compartilhamento.reiniciar).toHaveBeenCalledOnce()
  })

  it('ocupado, o botão de reiniciar espera', () => {
    montarQualidade({ codecPendente: 'av1', ocupado: true })
    expect(screen.getByRole('button', { name: 'Reiniciar transmissão' })).toBeDisabled()
  })

  it('sem pendência, não há aviso', () => {
    montarQualidade()
    expect(screen.queryByRole('button', { name: 'Reiniciar transmissão' })).not.toBeInTheDocument()
  })
})
