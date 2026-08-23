import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DecisaoDoGovernador } from '../src/sala/governador'
import { PERFIL_PADRAO } from '../src/sala/qualidade'
import { amostraVaziaDoEmissor, amostraVaziaDoEspectador } from '../src/telemetria/amostra'
import { TELEMETRIA_VAZIA, type Telemetria } from '../src/telemetria/coletor'
import { VALIDADE_DO_RELATO_MS, type Espectador } from '../src/telemetria/relato'
import { Transmissao } from '../src/telas/Sala/Transmissao'

const AGORA = 1_700_000_000_000

function emissor(parcial = {}) {
  return {
    ...amostraVaziaDoEmissor(AGORA),
    fpsCodificado: 29,
    fpsCaptura: 30,
    kbps: 3000,
    largura: 1920,
    altura: 1080,
    limitadoPor: 'cpu' as const,
    limitacaoSegundos: { nenhuma: 60, cpu: 30, banda: 10, outro: 0 },
    mudancasDeResolucao: 2,
    encodeMsPorQuadro: 7.5,
    codec: 'VP9',
    perfilDoCodec: 'profile-id=0',
    encoder: 'libvpx',
    encoderEmHardware: false,
    escalabilidade: 'L1T2',
    rtt: 42,
    perda: 0.5,
    jitterMs: 3,
    bandaDisponivelKbps: 8000,
    redeMedida: true,
    protocolo: 'udp' as const,
    tipoDeCandidato: 'srflx',
    robustez: { quadrosChave: 4, pli: 2, nack: 7, fir: 0 },
    ...parcial,
  }
}

function espectador(parcial: Partial<Espectador> = {}): Espectador {
  return {
    identidade: 'bia-1a2b3c',
    nome: 'Bia',
    vistoEm: AGORA,
    relato: {
      ...amostraVaziaDoEspectador(AGORA),
      fpsDecodificado: 28,
      freezes: { quantidade: 1, duracaoMs: 600 },
      perda: 1.5,
      atrasoDoBufferMs: 45,
      desvioEntreQuadrosMs: 4.2,
      redeMedida: true,
      protocolo: 'udp',
      rtt: 40,
      decoder: 'FFmpeg',
    },
    ...parcial,
  }
}

function montarTransmissao(telemetria: Telemetria, decisoes: DecisaoDoGovernador[] = [], perfilEfetivo = PERFIL_PADRAO) {
  return render(
    <Transmissao
      telemetria={telemetria}
      perfilEfetivo={perfilEfetivo}
      decisoes={decisoes}
      nomeDe={(identidade) => identidade.split('-')[0] ?? identidade}
    />,
  )
}

/** As marcas do eixo Y daquele gráfico, como a pessoa as lê. */
function eixoDe(container: HTMLElement, titulo: string): (string | null)[] {
  const figura = within(container).getByRole('img', { name: titulo }).closest('figure') as HTMLElement
  return [...figura.querySelectorAll('span[style]')].map((span) => span.textContent)
}

afterEach(() => vi.useRealTimers())

describe('aba Transmissão', () => {
  it('sem nada no ar, diz isso', () => {
    montarTransmissao(TELEMETRIA_VAZIA)
    expect(screen.getByText(/Nada no ar/)).toBeInTheDocument()
  })

  it('transmitindo: três gráficos, cartões de encoder, rede, limitação e robustez', () => {
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()] })

    expect(screen.getByRole('img', { name: 'FPS' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Bitrate' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Resolução' })).toBeInTheDocument()

    const encoder = screen.getByRole('group', { name: 'Encoder' })
    expect(encoder).toHaveTextContent('libvpx')
    expect(encoder).toHaveTextContent('software')
    expect(encoder).toHaveTextContent('VP9')
    expect(encoder).toHaveTextContent('L1T2')
    expect(encoder).toHaveTextContent('7,5 ms')

    const rede = screen.getByRole('group', { name: 'Rede' })
    expect(rede).toHaveTextContent('42 ms')
    expect(rede).toHaveTextContent('0,5%')
    expect(rede).toHaveTextContent('8,0 Mb/s')
    expect(rede).toHaveTextContent('UDP')
    expect(rede).toHaveTextContent('srflx')

    const limitacao = screen.getByRole('group', { name: 'Limitação' })
    expect(limitacao).toHaveTextContent('limitado pela CPU')
    expect(limitacao).toHaveTextContent('CPU 30%')
    expect(limitacao).toHaveTextContent('banda 10%')
    expect(limitacao).toHaveTextContent('2')

    const robustez = screen.getByRole('group', { name: 'Robustez' })
    expect(robustez).toHaveTextContent('PLI 2')
    expect(robustez).toHaveTextContent('NACK 7')
    // Rótulo e valor são coisas distintas: o valor é só o número.
    expect(within(robustez).getByText('keyframes').nextSibling).toHaveTextContent(/^4$/)
  })

  /**
   * O gráfico de Bitrate é a única janela do dono para conferir o governador em live real. Com o
   * teto dentro do domínio ele mentia em três direções ao mesmo tempo: achatava o tráfego no
   * chão, grampeava a banda medida no topo (escondendo a folga que é a condição de subir) e
   * reescalava o eixo a cada degrau — fazendo a linha *encolher* enquanto o governador acertava.
   */
  describe('gráfico de Bitrate: o eixo é das séries, o teto é marca', () => {
    const COM_TETO_ALTO = { ...PERFIL_PADRAO, tetoKbps: 12_000 }
    const historico = [emissor({ kbps: 300, bandaDisponivelKbps: 400 })]

    it('escala pelo tráfego e pela banda medida, não pelo teto conquistado', () => {
      const { container } = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: historico }, [], COM_TETO_ALTO)
      // tetoRedondo(400) = 500; com o teto de 12 Mb/s no domínio isso seria tetoRedondo(12000) = 20 Mb/s.
      expect(eixoDe(container, 'Bitrate')).toEqual(['250 kb/s', '500 kb/s'])
    })

    it('a banda disponível é desenhada no eixo como a outra série — comparar as duas é o produto', () => {
      const { container } = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: historico }, [], COM_TETO_ALTO)
      const figura = within(container).getByRole('img', { name: 'Bitrate' }).closest('figure') as HTMLElement
      const [saindo, banda] = [...figura.querySelectorAll('path')].map((linha) => linha.getAttribute('d'))
      // 300 de 500 e 400 de 500: alturas distintas, e nenhuma colada no topo (y = 0).
      expect(saindo).toMatch(/^M[\d.]+ 38\.4$/)
      expect(banda).toMatch(/^M[\d.]+ 19\.2$/)
    })

    it('o teto vira marca grampeada no topo, e o número segue legível na legenda', () => {
      const { container } = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: historico }, [], COM_TETO_ALTO)
      const figura = within(container).getByRole('img', { name: 'Bitrate' }).closest('figure') as HTMLElement
      expect(figura.querySelector('line[data-grampeada]')?.getAttribute('y1')).toBe('0')
      expect(within(figura).getByRole('list')).toHaveTextContent('teto 12,0 Mb/s')
    })

    it('o degrau seguinte do governador não reescala o eixo', () => {
      const { container } = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: historico }, [], COM_TETO_ALTO)
      const antes = eixoDe(container, 'Bitrate')

      cleanup()
      const depois = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: historico }, [], { ...PERFIL_PADRAO, tetoKbps: 24_000 })

      expect(eixoDe(depois.container, 'Bitrate')).toEqual(antes)
    })
  })

  it('rede não medida aparece com todas as letras, tanto no cartão quanto no Como chega', () => {
    const espectadores = new Map([
      ['bia-1a2b3c', espectador({ relato: { ...espectador().relato, redeMedida: false, protocolo: null, rtt: null } })],
    ])
    montarTransmissao({
      ...TELEMETRIA_VAZIA,
      emissor: [emissor({ redeMedida: false, protocolo: null, tipoDeCandidato: null, bandaDisponivelKbps: null })],
      espectadores,
    })

    const rede = screen.getByRole('group', { name: 'Rede' })
    expect(within(rede).getByText('caminho').nextSibling).toHaveTextContent('não medido')
    expect(within(rede).getByText('banda estimada').nextSibling).toHaveTextContent('não medido')
    expect(within(rede).getByText('RTT').nextSibling).toHaveTextContent('42 ms')

    const tabela = screen.getByRole('table', { name: 'Como chega' })
    const linha = within(tabela).getAllByRole('row')[1]
    expect(linha).toHaveTextContent('não medido')
  })

  it('onde o governador agiu, os gráficos do emissor ganham a marca', () => {
    const historico = [emissor({ emMs: AGORA }), emissor({ emMs: AGORA + 1000 }), emissor({ emMs: AGORA + 2000 })]
    const { container } = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: historico }, [{ emMs: AGORA + 1000, de: null, para: 30, motivo: 'cpu' }])
    // Uma marca por gráfico do emissor: FPS, Bitrate e Resolução.
    expect(container.querySelectorAll('line[data-marca]')).toHaveLength(3)
  })

  it('dynacast pausado aparece com todas as letras, não como zero', () => {
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor({ ativo: false, fpsCodificado: 0 })] })
    expect(screen.getByRole('status')).toHaveTextContent('pausado: ninguém assistindo')
  })

  it('"Como chega" lista cada espectador; quem passou da validade fica marcado como sumiu', () => {
    vi.useFakeTimers({ now: AGORA + VALIDADE_DO_RELATO_MS + 1000 })
    const espectadores = new Map([
      ['bia-1a2b3c', espectador({ vistoEm: AGORA + VALIDADE_DO_RELATO_MS })],
      ['caio-9f9f9f', espectador({ identidade: 'caio-9f9f9f', nome: 'Caio', vistoEm: AGORA })],
    ])
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()], espectadores })

    const tabela = screen.getByRole('table', { name: 'Como chega' })
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toHaveTextContent('Bia')
    expect(linhas[0]).toHaveTextContent('28 fps')
    expect(linhas[0]).toHaveTextContent('1 (0,6 s)')
    expect(linhas[0]).toHaveTextContent('1,5%')
    expect(linhas[0]).toHaveTextContent('45 ms')
    expect(linhas[0]).toHaveTextContent('4,2 ms')
    expect(linhas[0]).toHaveTextContent('UDP')
    expect(linhas[0]).not.toHaveAttribute('data-sumiu')
    expect(linhas[1]).toHaveTextContent('Caio')
    expect(linhas[1]).toHaveTextContent('sumiu')
    expect(linhas[1]).toHaveAttribute('data-sumiu')
  })

  it('transmitindo sem ninguém assistindo, a tabela diz isso', () => {
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()] })
    expect(screen.getByText(/Ninguém assistindo ainda/)).toBeInTheDocument()
  })

  it('quem assiste vê a versão própria: o que recebe de cada tela, com gráficos e cartões', () => {
    const recebida = { ...amostraVaziaDoEspectador(AGORA), fpsDecodificado: 24, fpsRecebido: 25, kbps: 2200, decoder: 'FFmpeg', decoderEmHardware: true, redeMedida: true, protocolo: 'udp' as const, rtt: 38, freezes: { quantidade: 2, duracaoMs: 900 }, desvioEntreQuadrosMs: 6.1, largura: 1920, altura: 1080 }
    montarTransmissao({ ...TELEMETRIA_VAZIA, recebidas: new Map([['bia-1a2b3c', [recebida]]]) })

    const secao = screen.getByRole('region', { name: 'Recebendo de bia' })
    expect(within(secao).getByRole('img', { name: 'FPS' })).toBeInTheDocument()
    expect(within(secao).getByRole('img', { name: 'Bitrate' })).toBeInTheDocument()
    expect(within(secao).getByRole('group', { name: 'Decoder' })).toHaveTextContent('FFmpeg')
    expect(within(secao).getByRole('group', { name: 'Decoder' })).toHaveTextContent('hardware')
    expect(within(secao).getByRole('group', { name: 'Estabilidade' })).toHaveTextContent('2 (0,9 s)')
    expect(within(secao).getByRole('group', { name: 'Estabilidade' })).toHaveTextContent('6,1 ms')
    expect(within(secao).getByRole('group', { name: 'Rede' })).toHaveTextContent('UDP')
  })

  it('assistindo com rede não medida, o cartão Rede diz isso no caminho e no RTT', () => {
    montarTransmissao({ ...TELEMETRIA_VAZIA, recebidas: new Map([['bia-1a2b3c', [amostraVaziaDoEspectador(AGORA)]]]) })
    const rede = within(screen.getByRole('region', { name: 'Recebendo de bia' })).getByRole('group', { name: 'Rede' })
    expect(within(rede).getByText('caminho').nextSibling).toHaveTextContent('não medido')
    expect(within(rede).getByText('RTT').nextSibling).toHaveTextContent('não medido')
  })

  it('Detalhes expande a última amostra crua, legível', async () => {
    const usuario = userEvent.setup()
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()] })

    await usuario.click(screen.getByText('Detalhes'))
    const detalhes = screen.getByText('Detalhes').closest('details')
    expect(detalhes).toHaveTextContent('perfilDoCodec')
    expect(detalhes).toHaveTextContent('profile-id=0')
    expect(detalhes).toHaveTextContent('bandaDisponivelKbps')
  })

  // Campos numéricos zerados já pareceram "sem valor" na árvore de
  // acessibilidade enquanto o cartão mostrava o número. O `dd` sempre usa `String(valor)` — 0
  // vira o texto "0", nunca some — então isto é lock de regressão, não a causa: com o DOM
  // provado correto, o achado é da ferramenta de leitura da árvore, não do render.
  it('Detalhes não escancha campos com valor 0 — o dd mostra "0", nunca fica vazio', async () => {
    const usuario = userEvent.setup()
    montarTransmissao({
      ...TELEMETRIA_VAZIA,
      emissor: [emissor({ kbps: 0, rtt: 0, perda: 0, mudancasDeResolucao: 0, fpsCaptura: 0 })],
    })

    await usuario.click(screen.getByText('Detalhes'))
    const detalhes = screen.getByText('Detalhes').closest('details') as HTMLElement

    for (const campo of ['kbps', 'rtt', 'perda', 'mudancasDeResolucao', 'fpsCaptura']) {
      const dd = within(detalhes).getByText(campo).nextElementSibling
      expect(dd).not.toBeNull()
      expect(dd).not.toBeEmptyDOMElement()
      expect(dd).toHaveTextContent('0')
    }
  })

  it('Copiar JSON leva histórico e relatos à área de transferência, com nomes legíveis', async () => {
    const usuario = userEvent.setup()
    const writeText = vi.fn(async (_texto: string) => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const espectadores = new Map([['bia-1a2b3c', espectador()]])
    // Dois "caio" homônimos: o JSON precisa distinguir pela identidade, não pelo nome.
    const recebidas = new Map([
      ['caio-111111', [amostraVaziaDoEspectador(AGORA)]],
      ['caio-222222', [amostraVaziaDoEspectador(AGORA), amostraVaziaDoEspectador(AGORA + 1000)]],
    ])
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor(), emissor()], espectadores, recebidas })

    await usuario.click(screen.getByRole('button', { name: 'Copiar JSON' }))

    expect(writeText).toHaveBeenCalledTimes(1)
    const copiado = JSON.parse(writeText.mock.calls[0]?.[0] as string) as Record<string, unknown>
    expect(typeof copiado.geradoEm).toBe('string')
    expect(copiado.emissor).toHaveLength(2)
    expect((copiado.espectadores as { nome: string }[])[0]?.nome).toBe('Bia')
    const recebidasCopiadas = copiado.recebidas as { identidade: string; nome: string; amostras: unknown[] }[]
    expect(recebidasCopiadas.map((r) => [r.identidade, r.nome, r.amostras.length])).toEqual([
      ['caio-111111', 'caio', 1],
      ['caio-222222', 'caio', 2],
    ])
    expect(await screen.findByText('Copiado')).toBeInTheDocument()
  })

  it('"Copiado" volta a "Copiar JSON" depois de 2 s, e desmontar antes disso não deixa timer pendurado', async () => {
    vi.useFakeTimers({ now: AGORA })
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async (_texto: string) => {}) } })
    const { unmount } = montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()] })
    // `fireEvent` e não `userEvent`: com timers falsos o userEvent espera um relógio que não anda.
    const copiar = () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copiar JSON' })))

    await copiar()
    expect(screen.getByText('Copiado')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(screen.getByRole('button', { name: 'Copiar JSON' })).toBeInTheDocument()

    await copiar()
    expect(screen.getByText('Copiado')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sem área de transferência, o JSON aparece num campo para copiar à mão', async () => {
    const usuario = userEvent.setup()
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()] })

    await usuario.click(screen.getByRole('button', { name: 'Copiar JSON' }))

    const campo = await screen.findByRole('textbox', { name: 'JSON da transmissão' })
    expect((campo as HTMLTextAreaElement).value).toContain('"geradoEm"')
  })
})
