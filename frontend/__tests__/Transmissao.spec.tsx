import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
      protocolo: 'udp',
      rtt: 40,
      decoder: 'FFmpeg',
    },
    ...parcial,
  }
}

function montarTransmissao(telemetria: Telemetria) {
  return render(<Transmissao telemetria={telemetria} perfil={PERFIL_PADRAO} nomeDe={(identidade) => identidade.split('-')[0] ?? identidade} />)
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
    expect(robustez).toHaveTextContent('keyframes 4')
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
    const recebida = { ...amostraVaziaDoEspectador(AGORA), fpsDecodificado: 24, fpsRecebido: 25, kbps: 2200, decoder: 'FFmpeg', decoderEmHardware: true, protocolo: 'udp' as const, rtt: 38, freezes: { quantidade: 2, duracaoMs: 900 }, desvioEntreQuadrosMs: 6.1, largura: 1920, altura: 1080 }
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

  it('Detalhes expande a última amostra crua, legível', async () => {
    const usuario = userEvent.setup()
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor()] })

    await usuario.click(screen.getByText('Detalhes'))
    const detalhes = screen.getByText('Detalhes').closest('details')
    expect(detalhes).toHaveTextContent('perfilDoCodec')
    expect(detalhes).toHaveTextContent('profile-id=0')
    expect(detalhes).toHaveTextContent('bandaDisponivelKbps')
  })

  it('Copiar JSON leva histórico e relatos à área de transferência, com nomes legíveis', async () => {
    const usuario = userEvent.setup()
    const writeText = vi.fn(async (_texto: string) => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const espectadores = new Map([['bia-1a2b3c', espectador()]])
    montarTransmissao({ ...TELEMETRIA_VAZIA, emissor: [emissor(), emissor()], espectadores })

    await usuario.click(screen.getByRole('button', { name: 'Copiar JSON' }))

    expect(writeText).toHaveBeenCalledTimes(1)
    const copiado = JSON.parse(writeText.mock.calls[0]?.[0] as string) as Record<string, unknown>
    expect(typeof copiado.geradoEm).toBe('string')
    expect(copiado.emissor).toHaveLength(2)
    expect((copiado.espectadores as { nome: string }[])[0]?.nome).toBe('Bia')
    expect(await screen.findByText('Copiado')).toBeInTheDocument()
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
