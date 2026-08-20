import { describe, expect, it } from 'vitest'
import { amostraVaziaDoEmissor } from '../src/telemetria/amostra'
import { resumirTransmissao } from '../src/telas/Sala/resumo'

const NO_AR = {
  ...amostraVaziaDoEmissor(1),
  codec: 'VP9',
  altura: 1080,
  largura: 1920,
  fpsCodificado: 30,
  kbps: 3000,
  protocolo: 'udp' as const,
}

describe('resumo da transmissão', () => {
  it('sem amostra não há resumo', () => {
    expect(resumirTransmissao(null, null)).toBeNull()
  })

  it('no ar e sem problema: codec · resolução · fps · taxa · ok, em verde', () => {
    expect(resumirTransmissao(NO_AR, null)).toEqual({
      partes: ['VP9', '1080p', '30 fps', '3,0 Mb/s'],
      estado: 'ok',
      tom: 'ok',
    })
  })

  it('o que ainda não se sabe vira travessão, não some', () => {
    const resumo = resumirTransmissao(amostraVaziaDoEmissor(1), null)
    expect(resumo?.partes).toEqual(['—', '—', '— fps', '—'])
  })

  it('limitado por CPU ou banda é âmbar', () => {
    expect(resumirTransmissao({ ...NO_AR, limitadoPor: 'cpu' }, null)).toMatchObject({ estado: 'limitado pela CPU', tom: 'atencao' })
    expect(resumirTransmissao({ ...NO_AR, limitadoPor: 'banda' }, null)).toMatchObject({ estado: 'limitado pela banda', tom: 'atencao' })
  })

  it('pausado pelo dynacast, TCP e recusa do encoder são vermelhos — nesta ordem de gravidade', () => {
    expect(resumirTransmissao({ ...NO_AR, ativo: false }, null)).toMatchObject({ estado: 'pausado: ninguém assistindo', tom: 'problema' })
    expect(resumirTransmissao({ ...NO_AR, protocolo: 'tcp' }, null)).toMatchObject({ estado: 'TCP', tom: 'problema' })
    expect(resumirTransmissao(NO_AR, { captura: 'aplicado', encoder: 'recusado' })).toMatchObject({ estado: 'encoder recusou', tom: 'problema' })
    expect(resumirTransmissao({ ...NO_AR, ativo: false, limitadoPor: 'cpu' }, { captura: 'aplicado', encoder: 'recusado' })).toMatchObject({ estado: 'encoder recusou' })
  })
})
