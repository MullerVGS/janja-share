import { useId, type ReactNode } from 'react'
import type { AmostraDoEmissor, AmostraDoEspectador, Protocolo } from '../../telemetria/amostra'
import { FRASE_DA_LIMITACAO, formatarKbps, formatarMs, formatarPct, formatarResolucao } from '../../telemetria/formatar'
import { sumiu, type Espectador } from '../../telemetria/relato'
import estilos from './Transmissao.module.css'

/** Um cartão: título e pares rótulo → valor. O valor lidera; o rótulo explica. */
export function Cartao({ titulo, linhas }: { titulo: string; linhas: [string, ReactNode][] }) {
  const id = useId()
  return (
    <section className={estilos.cartao} role="group" aria-labelledby={id}>
      <h3 className={estilos.tituloDoCartao} id={id}>
        {titulo}
      </h3>
      <dl className={estilos.linhas}>
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className={estilos.linha}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const NAO_MEDIDO = 'não medido'

/** O caminho da rede; sem `candidate-pair` no relatório a resposta é "não medido", não um travessão. */
function caminho(amostra: { redeMedida: boolean; protocolo: Protocolo | null }, tipo: string | null = null): string {
  if (!amostra.redeMedida) return NAO_MEDIDO
  if (!amostra.protocolo) return '—'
  return tipo ? `${amostra.protocolo.toUpperCase()} · ${tipo}` : amostra.protocolo.toUpperCase()
}

function hardware(emHardware: boolean | null): string {
  return emHardware === null ? '' : emHardware ? ' · hardware' : ' · software'
}

function freezes(valor: { quantidade: number; duracaoMs: number }): string {
  return `${valor.quantidade} (${(valor.duracaoMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s)`
}

export function CartoesDoEmissor({ amostra }: { amostra: AmostraDoEmissor }) {
  const { limitacaoSegundos: segundos, robustez } = amostra
  const total = segundos.nenhuma + segundos.cpu + segundos.banda + segundos.outro
  const pct = (parte: number) => (total === 0 ? '0%' : `${Math.round((parte / total) * 100)}%`)

  return (
    <div className={estilos.cartoes}>
      <Cartao
        titulo="Encoder"
        linhas={[
          ['implementação', amostra.encoder ? `${amostra.encoder}${hardware(amostra.encoderEmHardware)}` : '—'],
          ['codec', amostra.codec ? `${amostra.codec}${amostra.perfilDoCodec ? ` · ${amostra.perfilDoCodec}` : ''}` : '—'],
          ['escalabilidade', amostra.escalabilidade ?? '—'],
          ['encode por quadro', formatarMs(amostra.encodeMsPorQuadro)],
        ]}
      />
      <Cartao
        titulo="Rede"
        linhas={[
          ['RTT', formatarMs(amostra.rtt)],
          ['perda', formatarPct(amostra.perda)],
          ['jitter', formatarMs(amostra.jitterMs)],
          ['banda estimada', amostra.redeMedida ? formatarKbps(amostra.bandaDisponivelKbps) : NAO_MEDIDO],
          ['caminho', caminho(amostra, amostra.tipoDeCandidato)],
        ]}
      />
      <Cartao
        titulo="Limitação"
        linhas={[
          ['agora', amostra.limitadoPor ? FRASE_DA_LIMITACAO[amostra.limitadoPor] : 'nenhuma'],
          ['acumulada', `CPU ${pct(segundos.cpu)} · banda ${pct(segundos.banda)} · outro ${pct(segundos.outro)}`],
          ['trocas de resolução', String(amostra.mudancasDeResolucao)],
        ]}
      />
      <Cartao
        titulo="Robustez"
        linhas={[
          ['pedidos de reenvio', `PLI ${robustez.pli} · NACK ${robustez.nack} · FIR ${robustez.fir}`],
          ['keyframes', String(robustez.quadrosChave)],
        ]}
      />
    </div>
  )
}

export function CartoesDoEspectador({ amostra }: { amostra: AmostraDoEspectador }) {
  return (
    <div className={estilos.cartoes}>
      <Cartao
        titulo="Decoder"
        linhas={[
          ['implementação', amostra.decoder ? `${amostra.decoder}${hardware(amostra.decoderEmHardware)}` : '—'],
          ['codec', amostra.codec ?? '—'],
          ['resolução', formatarResolucao(amostra.largura, amostra.altura)],
        ]}
      />
      <Cartao
        titulo="Rede"
        linhas={[
          ['caminho', caminho(amostra)],
          ['RTT', amostra.redeMedida ? formatarMs(amostra.rtt) : NAO_MEDIDO],
          ['perda', formatarPct(amostra.perda)],
          ['jitter', formatarMs(amostra.jitterMs)],
          ['atraso do buffer', formatarMs(amostra.atrasoDoBufferMs)],
        ]}
      />
      <Cartao
        titulo="Estabilidade"
        linhas={[
          ['freezes', freezes(amostra.freezes)],
          ['desvio entre quadros', formatarMs(amostra.desvioEntreQuadrosMs)],
          ['descartados', String(amostra.quadrosDescartados)],
        ]}
      />
    </div>
  )
}

/** A tabela de quem assiste: o que cada pessoa está recebendo, pelo relato dela. */
export function ComoChega({ espectadores }: { espectadores: ReadonlyMap<string, Espectador> }) {
  const agora = Date.now()
  const lista = [...espectadores.values()]

  if (lista.length === 0) {
    return <p className={estilos.vazio}>Ninguém assistindo ainda — os relatos aparecem aqui.</p>
  }

  return (
    <div className={estilos.rolagem}>
      <table className={estilos.tabela} aria-label="Como chega">
        <thead>
          <tr>
            <th>quem</th>
            <th>fps</th>
            <th>freezes</th>
            <th>perda</th>
            <th>atraso</th>
            <th>estabilidade</th>
            <th>rede</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((espectador) => {
            const { relato } = espectador
            const apagado = sumiu(espectador, agora)
            return (
              <tr key={espectador.identidade} data-sumiu={apagado || undefined}>
                <td>
                  {espectador.nome}
                  {apagado && <span className={estilos.sumiu}> · sumiu</span>}
                </td>
                <td>{relato.fpsDecodificado === null ? '—' : `${relato.fpsDecodificado} fps`}</td>
                <td>{freezes(relato.freezes)}</td>
                <td>{formatarPct(relato.perda)}</td>
                <td>{formatarMs(relato.atrasoDoBufferMs)}</td>
                <td>{formatarMs(relato.desvioEntreQuadrosMs)}</td>
                <td>{relato.redeMedida ? `${caminho(relato)} · ${formatarMs(relato.rtt)}` : NAO_MEDIDO}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
