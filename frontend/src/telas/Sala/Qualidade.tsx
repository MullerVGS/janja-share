import { descreverDegrau, NOME_DO_MOTIVO, type EstadoDoGovernador } from '../../sala/governador'
import {
  CEDER,
  CODECS,
  CONTEUDOS,
  OPCOES_DE_FPS,
  RESOLUCOES,
  TETO,
  trocarConteudo,
  type Ceder,
  type Codec,
  type Conteudo,
  type PerfilDeQualidade,
  type Resolucao,
} from '../../sala/qualidade'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import { formatarKbps } from '../../telemetria/formatar'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Segmentado, type OpcaoSegmentada } from '../../ui/Segmentado'
import estilos from './Qualidade.module.css'

const OPCOES_DE_CONTEUDO: OpcaoSegmentada<Conteudo>[] = (Object.keys(CONTEUDOS) as Conteudo[]).map((valor) => ({
  valor,
  rotulo: CONTEUDOS[valor].rotulo,
  descricao: CONTEUDOS[valor].descricao,
}))

const OPCOES_DE_CODEC: OpcaoSegmentada<Codec>[] = (Object.keys(CODECS) as Codec[]).map((valor) => ({
  valor,
  rotulo: CODECS[valor].rotulo,
  descricao: CODECS[valor].descricao,
}))

const OPCOES_DE_RESOLUCAO: OpcaoSegmentada<Resolucao>[] = RESOLUCOES.map((opcao) => ({
  valor: opcao.valor,
  rotulo: opcao.rotulo,
  descricao: opcao.altura === null ? 'a tela vai como o monitor entrega' : `no máximo ${opcao.altura} linhas`,
}))

const OPCOES_FPS: OpcaoSegmentada<number>[] = OPCOES_DE_FPS.map((fps) => ({
  valor: fps,
  rotulo: String(fps),
  descricao: `${fps} quadros por segundo`,
}))

const OPCOES_DE_CEDER: OpcaoSegmentada<Ceder>[] = (Object.keys(CEDER) as Ceder[]).map((valor) => ({
  valor,
  rotulo: CEDER[valor].rotulo,
  descricao: CEDER[valor].explicacao,
}))

function rotuloDaResolucao(resolucao: Resolucao): string {
  return RESOLUCOES.find((opcao) => opcao.valor === resolucao)?.rotulo ?? resolucao
}

/**
 * O que o governador está fazendo, em uma linha: o que está no ar e para onde ele foi.
 *
 * `subindo` é a postura, não uma promessa: significa que o teto já passou do valor de partida e
 * que a cada 30 s limpos ele tenta de novo. O número ao lado é sempre o teto de agora, então a
 * linha nunca promete uma banda que não existe.
 */
function descreverAutomatico(pedido: PerfilDeQualidade, efetivo: PerfilDeQualidade, estado: EstadoDoGovernador): string {
  const forma = [formatarKbps(efetivo.tetoKbps), rotuloDaResolucao(efetivo.resolucao), `${efetivo.fps} fps`]
  const degrau = descreverDegrau(pedido, estado)
  const unidade = pedido.ceder === 'quadros' ? ' fps' : ''
  const acao = degrau
    ? `cedeu para ${degrau.degrau}${unidade} — ${degrau.motivo}`
    : estado.tetoKbps === null
      ? 'no ponto de partida'
      : estado.tetoKbps < pedido.tetoKbps
        ? `cedeu o teto — ${NOME_DO_MOTIVO[estado.motivo ?? 'banda']}`
        : 'subindo'
  return [...forma, acao].join(' · ')
}

/**
 * A aba que ajusta a transmissão de tela.
 *
 * O produto são os dois botões do topo: a pessoa diz o que está mostrando e a telemetria faz o
 * resto — o governador procura o teto do link e cede quando aperta. Abaixo deles vem a linha
 * que conta o que ele está fazendo agora, e só.
 *
 * **Avançado** é saída de emergência, não painel: cada controle de lá vale no ato e sem
 * derrubar quem assiste — exceto o codec, que republica a faixa e pisca por um segundo. Mexer
 * em qualquer um deles zera o governador, porque o pedido mudou.
 */
export function Qualidade({ compartilhamento }: { compartilhamento: Compartilhamento }) {
  const {
    perfil,
    definirPerfil,
    perfilEfetivo,
    relatorio,
    ativo,
    automatico,
    definirAutomatico,
    governador,
    codecPendente,
    reiniciar,
    ocupado,
  } = compartilhamento
  const ajustar = (parcial: Partial<PerfilDeQualidade>) => definirPerfil({ ...perfil, ...parcial })
  const degrau = descreverDegrau(perfil, governador)

  return (
    <section className={estilos.aba} aria-label="Qualidade da tela">
      <header className={estilos.cabecalho}>
        <h2 className={estilos.titulo}>Qualidade da tela</h2>
        {!ativo && <span className={estilos.dica}>vale no próximo compartilhamento</span>}
      </header>

      <div className={estilos.presets}>
        <Segmentado
          rotulo="Conteúdo"
          opcoes={OPCOES_DE_CONTEUDO}
          valor={perfil.conteudo}
          aoEscolher={(conteudo) => definirPerfil(trocarConteudo(perfil, conteudo))}
        />
        <p className={estilos.explicacao}>{CONTEUDOS[perfil.conteudo].descricao}</p>
      </div>

      {/* O estado do governador, na forma que a pessoa lê: o que está no ar e o que ele fez. */}
      {automatico && (
        <p className={estilos.estadoDoAuto} role="status" aria-label="Estado do governador" data-segurando={degrau ? '' : undefined}>
          <span>{descreverAutomatico(perfil, perfilEfetivo, governador)}</span>
          {degrau && (
            <Botao aparencia="fantasma" className={estilos.forcar} onClick={() => definirAutomatico(false)}>
              forçar
            </Botao>
          )}
        </p>
      )}

      <details className={estilos.avancado}>
        <summary className={estilos.sumario}>Avançado</summary>
        <div className={estilos.controles}>
          <div className={estilos.bloco}>
            <Segmentado rotulo="Codec" opcoes={OPCOES_DE_CODEC} valor={perfil.codec} aoEscolher={(codec) => ajustar({ codec })} />
            <p className={estilos.explicacao}>{CODECS[perfil.codec].descricao}</p>
          </div>

          <Segmentado
            rotulo="Resolução"
            opcoes={OPCOES_DE_RESOLUCAO}
            valor={perfil.resolucao}
            aoEscolher={(resolucao) => ajustar({ resolucao })}
          />

          <Segmentado rotulo="FPS" opcoes={OPCOES_FPS} valor={perfil.fps} aoEscolher={(fps) => ajustar({ fps })} />

          <div className={estilos.bloco}>
            <Segmentado
              rotulo="Sob aperto, ceder"
              opcoes={OPCOES_DE_CEDER}
              valor={perfil.ceder}
              aoEscolher={(ceder) => ajustar({ ceder })}
            />
            <p className={estilos.explicacao}>{CEDER[perfil.ceder].explicacao}</p>
          </div>

          <div className={estilos.teto}>
            <label className={estilos.rotuloDoTeto} htmlFor="teto-de-bitrate">
              Bitrate de partida
              <output className={estilos.valorDoTeto} htmlFor="teto-de-bitrate">
                {formatarKbps(perfil.tetoKbps)}
              </output>
            </label>
            <input
              id="teto-de-bitrate"
              className={estilos.slider}
              type="range"
              min={TETO.minimoKbps}
              max={TETO.maximoKbps}
              step={TETO.passoKbps}
              value={perfil.tetoKbps}
              onChange={(evento) => ajustar({ tetoKbps: Number(evento.target.value) })}
            />
          </div>

          <label className={estilos.chave}>
            <input
              type="checkbox"
              role="switch"
              checked={automatico}
              onChange={(evento) => definirAutomatico(evento.target.checked)}
            />
            <span>Automático</span>
          </label>
        </div>
      </details>

      {codecPendente && (
        <Aviso tom="neutro">
          <span>{CODECS[codecPendente].rotulo} não entrou no ar: vale no próximo compartilhamento.</span>{' '}
          <Botao aparencia="fantasma" ocupado={ocupado} onClick={() => void reiniciar()}>
            Reiniciar transmissão
          </Botao>
        </Aviso>
      )}

      {relatorio?.captura === 'recusado' && (
        <p className={estilos.recusa} role="status">
          A captura recusou este ajuste{relatorio.falhaDaCaptura ? `: ${relatorio.falhaDaCaptura}` : ''}. A fonte
          compartilhada não entrega mais que isso — o teto e os eixos continuam valendo.
        </p>
      )}

      {/* Recusa do encoder é mais grave que a da captura: o slider mostra o valor novo, mas o
          que está no ar continua sendo o anterior. Sem este aviso, o painel mentiria. */}
      {relatorio?.encoder === 'recusado' && (
        <p className={estilos.recusaGrave} role="alert">
          O encoder recusou este ajuste{relatorio.falhaDoEncoder ? `: ${relatorio.falhaDoEncoder}` : ''}. O teto e o
          eixo que estão no ar ainda são os anteriores — mexa em qualquer controle para tentar de novo.
        </p>
      )}
    </section>
  )
}
