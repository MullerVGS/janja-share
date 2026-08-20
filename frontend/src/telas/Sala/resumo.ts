import type { AmostraDoEmissor } from '../../telemetria/amostra'
import { FRASE_DA_LIMITACAO, formatarKbps } from '../../telemetria/formatar'
import { descreverDegrau, type EstadoDoGovernador } from '../../sala/governador'
import type { PerfilDeQualidade, RelatorioDeAplicacao } from '../../sala/qualidade'

/** Menta = no ar; âmbar = limitado; coral = algo que a pessoa precisa olhar. */
export type Tom = 'ok' | 'atencao' | 'problema'

export interface Resumo {
  /** `VP9 · 1080p · 30 fps · 3,0 Mb/s · Auto 30` — o estado vem separado para ganhar cor. */
  partes: string[]
  estado: string
  tom: Tom
}

export interface Governador {
  pedido: PerfilDeQualidade
  estado: EstadoDoGovernador
}

/** A linha de resumo da transmissão; `null` quando não há o que resumir. */
export function resumirTransmissao(
  amostra: AmostraDoEmissor | null,
  relatorio: RelatorioDeAplicacao | null,
  governador: Governador | null,
): Resumo | null {
  if (!amostra) return null

  const degrau = governador ? descreverDegrau(governador.pedido, governador.estado) : null
  const partes = [
    amostra.codec ?? '—',
    amostra.altura === null ? '—' : `${amostra.altura}p`,
    `${amostra.fpsCodificado ?? '—'} fps`,
    formatarKbps(amostra.kbps),
    ...(degrau ? [`Auto ${degrau.degrau}`] : []),
  ]

  if (relatorio?.encoder === 'recusado') return { partes, estado: 'encoder recusou', tom: 'problema' }
  if (!amostra.ativo) return { partes, estado: 'pausado: ninguém assistindo', tom: 'problema' }
  if (amostra.protocolo === 'tcp') return { partes, estado: 'TCP', tom: 'problema' }
  if (amostra.limitadoPor) return { partes, estado: FRASE_DA_LIMITACAO[amostra.limitadoPor], tom: 'atencao' }
  return { partes, estado: 'ok', tom: 'ok' }
}
