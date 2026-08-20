import { useEffect, useState } from 'react'
import { alturaDaResolucao, type PerfilDeQualidade } from '../../sala/qualidade'
import type { AmostraDoEmissor, AmostraDoEspectador } from '../../telemetria/amostra'
import type { Telemetria } from '../../telemetria/coletor'
import { formatarKbps } from '../../telemetria/formatar'
import { ultima, type Historico } from '../../telemetria/historico'
import { Botao } from '../../ui/Botao'
import { Grafico } from '../../ui/Grafico'
import { faixas } from '../../ui/grafico'
import { IconeCerto, IconeCopiar } from '../../ui/Icone'
import { CartoesDoEmissor, CartoesDoEspectador, ComoChega } from './Cartoes'
import estilos from './Transmissao.module.css'

interface Props {
  telemetria: Telemetria
  perfil: PerfilDeQualidade
  /** Nome de quem publica uma tela, pela identidade — a telemetria só conhece identidades. */
  nomeDe(identidade: string): string
}

const fps = (valor: number) => `${valor} fps`
const linhas = (valor: number) => `${valor}p`

/**
 * A aba Transmissão: os últimos 2 minutos do que sai (se estou compartilhando) e do que
 * chega de cada tela que assisto. Nada aqui é guardado — é o retrato que existe enquanto a
 * sala está aberta, e o "Copiar JSON" é o jeito de levar o retrato para fora.
 */
export function Transmissao({ telemetria, perfil, nomeDe }: Props) {
  const emissor = ultima(telemetria.emissor)
  const recebidas = [...telemetria.recebidas]

  if (!emissor && recebidas.length === 0) {
    return <p className={estilos.vazio}>Nada no ar. Compartilhe uma tela ou assista à de alguém para ver os números.</p>
  }

  return (
    <div className={estilos.aba}>
      {emissor && (
        <section className={estilos.secao} aria-label="Minha transmissão">
          {!emissor.ativo && (
            <p className={estilos.pausado} role="status">
              pausado: ninguém assistindo — o encoder volta sozinho quando alguém abrir a tela.
            </p>
          )}
          <GraficosDoEmissor historico={telemetria.emissor} perfil={perfil} />
          <CartoesDoEmissor amostra={emissor} />

          <h3 className={estilos.subtitulo}>Como chega</h3>
          <ComoChega espectadores={telemetria.espectadores} />
        </section>
      )}

      {recebidas.map(([identidade, historico]) => (
        <RecebendoDe key={identidade} nome={nomeDe(identidade)} historico={historico} />
      ))}

      <Detalhes telemetria={telemetria} nomeDe={nomeDe} />
    </div>
  )
}

function GraficosDoEmissor({ historico, perfil }: { historico: Historico<AmostraDoEmissor>; perfil: PerfilDeQualidade }) {
  const limitacoes = faixas(historico.map((amostra) => amostra.limitadoPor))
  const alturaPedida = alturaDaResolucao(perfil.resolucao)

  return (
    <div className={estilos.graficos}>
      <Grafico
        titulo="FPS"
        series={[
          { nome: 'codificado', valores: historico.map((a) => a.fpsCodificado), cor: 'menta', destaque: true },
          { nome: 'captura', valores: historico.map((a) => a.fpsCaptura), cor: 'lilas' },
        ]}
        referencias={[{ nome: 'alvo', valor: perfil.fps }]}
        faixas={limitacoes}
        piso={perfil.fps}
        formatar={fps}
      />
      <Grafico
        titulo="Bitrate"
        series={[
          { nome: 'saindo', valores: historico.map((a) => a.kbps), cor: 'menta', destaque: true },
          { nome: 'disponível estimada', valores: historico.map((a) => a.bandaDisponivelKbps), cor: 'lilas', foraDoEixo: true },
        ]}
        referencias={[{ nome: 'teto', valor: perfil.tetoKbps }]}
        faixas={limitacoes}
        piso={perfil.tetoKbps}
        formatar={formatarKbps}
      />
      <Grafico
        titulo="Resolução"
        series={[
          { nome: 'codificada', valores: historico.map((a) => a.altura), cor: 'menta', destaque: true },
          { nome: 'captura', valores: historico.map((a) => a.alturaDaCaptura), cor: 'lilas' },
        ]}
        referencias={alturaPedida === null ? [] : [{ nome: 'pedida', valor: alturaPedida }]}
        faixas={limitacoes}
        degraus
        formatar={linhas}
      />
    </div>
  )
}

function RecebendoDe({ nome, historico }: { nome: string; historico: Historico<AmostraDoEspectador> }) {
  const amostra = ultima(historico)
  return (
    <section className={estilos.secao} aria-label={`Recebendo de ${nome}`}>
      <h3 className={estilos.subtitulo}>Recebendo de {nome}</h3>
      <div className={estilos.graficos}>
        <Grafico
          titulo="FPS"
          series={[
            { nome: 'decodificado', valores: historico.map((a) => a.fpsDecodificado), cor: 'menta', destaque: true },
            { nome: 'recebido', valores: historico.map((a) => a.fpsRecebido), cor: 'lilas' },
          ]}
          formatar={fps}
        />
        <Grafico titulo="Bitrate" series={[{ nome: 'chegando', valores: historico.map((a) => a.kbps), cor: 'menta' }]} formatar={formatarKbps} />
      </div>
      {amostra && <CartoesDoEspectador amostra={amostra} />}
    </section>
  )
}

function montarJson(telemetria: Telemetria, nomeDe: (identidade: string) => string): string {
  return JSON.stringify(
    {
      geradoEm: new Date().toISOString(),
      emissor: telemetria.emissor,
      espectadores: [...telemetria.espectadores.values()],
      recebidas: [...telemetria.recebidas].map(([identidade, amostras]) => ({ identidade, nome: nomeDe(identidade), amostras })),
    },
    null,
    2,
  )
}

type EstadoDaCopia = 'pronto' | 'copiado' | 'manual'

/** O cru, legível: a última amostra campo a campo, e o botão que leva tudo para fora. */
function Detalhes({ telemetria, nomeDe }: Omit<Props, 'perfil'>) {
  const [copia, setCopia] = useState<EstadoDaCopia>('pronto')
  const [json, setJson] = useState('')

  // "Copiado" dura 2 s; trocar de aba antes disso desmonta a aba, e o timer vai junto.
  useEffect(() => {
    if (copia !== 'copiado') return
    const volta = setTimeout(() => setCopia('pronto'), 2000)
    return () => clearTimeout(volta)
  }, [copia])
  // Transmitindo, o cru é o que sai; só assistindo, é o que chega da primeira tela.
  const amostra = (ultima(telemetria.emissor) ?? ultima([...telemetria.recebidas.values()][0] ?? [])) as
    | Record<string, unknown>
    | null

  async function copiar() {
    const texto = montarJson(telemetria, nomeDe)
    try {
      if (!navigator.clipboard) throw new Error('sem área de transferência')
      await navigator.clipboard.writeText(texto)
      setCopia('copiado')
    } catch {
      // Sem permissão ou sem API (http, iframe): o campo selecionável é o caminho que sempre funciona.
      setJson(texto)
      setCopia('manual')
    }
  }

  return (
    <div className={estilos.rodape}>
      <div className={estilos.acoes}>
        <Botao aparencia="secundario" onClick={() => void copiar()}>
          {copia === 'copiado' ? <IconeCerto tamanho={15} /> : <IconeCopiar tamanho={15} />}
          {copia === 'copiado' ? 'Copiado' : 'Copiar JSON'}
        </Botao>
      </div>
      {copia === 'manual' && (
        <textarea
          className={estilos.campoDoJson}
          aria-label="JSON da transmissão"
          readOnly
          value={json}
          onFocus={(evento) => evento.currentTarget.select()}
        />
      )}
      {amostra && (
        <details className={estilos.detalhes}>
          <summary className={estilos.sumario}>Detalhes</summary>
          <dl className={estilos.cru}>
            {Object.entries(amostra).map(([campo, valor]) => (
              <div key={campo} className={estilos.linha}>
                <dt>{campo}</dt>
                <dd>{typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : String(valor)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  )
}
