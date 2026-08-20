import { describe, expect, it } from 'vitest'
import { GOVERNADOR_PARADO } from '../src/sala/governador'
import { PERFIL_PADRAO } from '../src/sala/qualidade'
import { amostraVaziaDoEmissor } from '../src/telemetria/amostra'
import { resumirTransmissao } from '../src/telas/Sala/resumo'

const NO_AR = {
  ...amostraVaziaDoEmissor(1),
  codec: 'VP9',
  altura: 1080,
  largura: 1920,
  fpsCodificado: 30,
  kbps: 3000,
  redeMedida: true,
  protocolo: 'udp' as const,
}

describe('resumo da transmissão', () => {
  it('sem amostra não há resumo', () => {
    expect(resumirTransmissao(null, null, null)).toBeNull()
  })

  it('no ar e sem problema: codec · resolução · fps · taxa · ok, em verde', () => {
    expect(resumirTransmissao(NO_AR, null, null)).toEqual({
      partes: ['VP9', '1080p', '30 fps', '3,0 Mb/s'],
      estado: 'ok',
      tom: 'ok',
    })
  })

  it('o que ainda não se sabe vira travessão, não some', () => {
    const resumo = resumirTransmissao(amostraVaziaDoEmissor(1), null, null)
    expect(resumo?.partes).toEqual(['—', '—', '— fps', '—'])
  })

  it('limitado por CPU ou banda é âmbar', () => {
    expect(resumirTransmissao({ ...NO_AR, limitadoPor: 'cpu' }, null, null)).toMatchObject({ estado: 'limitado pela CPU', tom: 'atencao' })
    expect(resumirTransmissao({ ...NO_AR, limitadoPor: 'banda' }, null, null)).toMatchObject({ estado: 'limitado pela banda', tom: 'atencao' })
  })

  it('rede não medida não é TCP: o resumo fica verde', () => {
    expect(resumirTransmissao({ ...NO_AR, redeMedida: false, protocolo: null }, null, null)).toMatchObject({ estado: 'ok', tom: 'ok' })
  })

  it('pausado pelo dynacast, TCP e recusa do encoder são vermelhos — nesta ordem de gravidade', () => {
    expect(resumirTransmissao({ ...NO_AR, ativo: false }, null, null)).toMatchObject({ estado: 'pausado: ninguém assistindo', tom: 'problema' })
    expect(resumirTransmissao({ ...NO_AR, protocolo: 'tcp' }, null, null)).toMatchObject({ estado: 'TCP', tom: 'problema' })
    expect(resumirTransmissao(NO_AR, { captura: 'aplicado', encoder: 'recusado' }, null)).toMatchObject({ estado: 'encoder recusou', tom: 'problema' })
    expect(resumirTransmissao({ ...NO_AR, ativo: false, limitadoPor: 'cpu' }, { captura: 'aplicado', encoder: 'recusado' }, null)).toMatchObject({ estado: 'encoder recusou' })
  })

  it('com o governador segurando um degrau, ganha "Auto 30" (ou "Auto 720p") antes do estado', () => {
    const quadros = { pedido: { ...PERFIL_PADRAO, fps: 60, ceder: 'quadros' as const }, estado: { ...GOVERNADOR_PARADO, degrau: 30, motivo: 'cpu' as const } }
    expect(resumirTransmissao(NO_AR, null, quadros)?.partes).toEqual(['VP9', '1080p', '30 fps', '3,0 Mb/s', 'Auto 30'])

    const resolucao = { pedido: { ...PERFIL_PADRAO, ceder: 'resolucao' as const }, estado: { ...GOVERNADOR_PARADO, degrau: 720, motivo: 'banda' as const } }
    expect(resumirTransmissao(NO_AR, null, resolucao)?.partes).toEqual(['VP9', '1080p', '30 fps', '3,0 Mb/s', 'Auto 720p'])

    const semDegrau = { pedido: PERFIL_PADRAO, estado: GOVERNADOR_PARADO }
    expect(resumirTransmissao(NO_AR, null, semDegrau)?.partes).toHaveLength(4)
  })
})
