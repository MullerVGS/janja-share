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

type EscolhaDeCodec = 'auto' | Codec

/**
 * Automático primeiro, e as quatro escolhas atrás dele. Quem sabe o que quer continua mandando —
 * inclusive em AV1, que o automático nunca escolhe sozinho para não deixar ninguém sem imagem
 * por uma decisão que a máquina tomou.
 */
const OPCOES_DE_CODEC: OpcaoSegmentada<EscolhaDeCodec>[] = [
  { valor: 'auto', rotulo: 'Automático', descricao: 'a máquina escolhe, e corrige pelo que medir' },
  ...(Object.keys(CODECS) as Codec[]).map((valor) => ({
  valor,
    rotulo: CODECS[valor].rotulo,
    descricao: CODECS[valor].descricao,
  })),
]

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

/** O que está no ar, campo a campo — a metade da linha de status que não muda de assunto. */
function descreverForma(efetivo: PerfilDeQualidade): string {
  return [formatarKbps(efetivo.tetoKbps), rotuloDaResolucao(efetivo.resolucao), `${efetivo.fps} fps`].join(' · ')
}

/**
 * O que o governador está fazendo, em uma linha: o que está no ar e para onde ele foi.
 *
 * `subindo` é a postura, não uma promessa: significa que o teto já passou do valor de partida e
 * que a cada 30 s limpos ele tenta de novo. Quando a busca já bateu no que a banda medida
 * deixa, ele para de tentar — e continuar dizendo "subindo" ali seria promessa que nenhuma
 * janela limpa vai cumprir. O número ao lado é sempre o teto de agora.
 */
function descreverAutomatico(pedido: PerfilDeQualidade, efetivo: PerfilDeQualidade, estado: EstadoDoGovernador): string {
  const degrau = descreverDegrau(pedido, estado)
  const unidade = pedido.ceder === 'quadros' ? ' fps' : ''
  const acao = degrau
    ? `cedeu para ${degrau.degrau}${unidade} — ${degrau.motivo}`
    : estado.tetoKbps !== null && estado.tetoKbps < pedido.tetoKbps
      ? `cedeu o teto — ${NOME_DO_MOTIVO[estado.motivo ?? 'banda']}`
      : estado.tetoNoAlvo
        ? 'no teto do link'
        : estado.tetoKbps === null
          ? 'no ponto de partida'
          : 'subindo'
  return `${descreverForma(efetivo)} · ${acao}`
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
    codecPreferido,
    definirCodecPreferido,
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

      {/* O estado do governador, na forma que a pessoa lê: o que está no ar e o que ele fez.
          A linha existe **sempre**, ligado ou desligado. "forçar" desliga o automático num
          clique e grava a escolha; se a linha inteira sumisse junto, o que sobraria era uma
          transmissão sem indicador nenhum e a única chave de religar escondida dentro de um
          <details> fechado por padrão — a saída de um clique com a volta de três. */}
      <p
        className={estilos.estadoDoAuto}
        role="status"
        aria-label="Estado do governador"
        data-segurando={automatico && degrau ? '' : undefined}
        data-desligado={automatico ? undefined : ''}
      >
        {automatico ? (
          <>
            <span>{descreverAutomatico(perfil, perfilEfetivo, governador)}</span>
            {degrau && (
              <Botao aparencia="fantasma" className={estilos.forcar} onClick={() => definirAutomatico(false)}>
                forçar
              </Botao>
            )}
          </>
        ) : (
          <>
            <span>{descreverForma(perfilEfetivo)} · automático desligado</span>
            <Botao aparencia="fantasma" className={estilos.forcar} onClick={() => definirAutomatico(true)}>
              religar
            </Botao>
          </>
        )}
      </p>

      <details className={estilos.avancado}>
        <summary className={estilos.sumario}>Avançado</summary>
        <div className={estilos.controles}>
          <div className={estilos.bloco}>
            <Segmentado
              rotulo="Codec"
              opcoes={OPCOES_DE_CODEC}
              valor={codecPreferido}
              aoEscolher={definirCodecPreferido}
            />
            <p className={estilos.explicacao}>
              {codecPreferido === 'auto'
                ? `${CODECS[perfilEfetivo.codec].rotulo} no ar — ${
                    governador.codec
                      ? 'escolhido depois que o anterior não deu conta desta máquina'
                      : 'escolhido pela capacidade desta máquina'
                  }`
                : CODECS[codecPreferido].descricao}
            </p>
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

      {governador.codec && governador.codec !== perfil.codec && (
        <Aviso tom="neutro">
          <span>
            {CODECS[perfil.codec].rotulo} entregava bem menos do que esta máquina autorizou; a tela
            voltou em {CODECS[governador.codec].rotulo}.
          </span>{' '}
          <Botao aparencia="fantasma" onClick={() => definirCodecPreferido(perfil.codec)}>
            Desfazer
          </Botao>
        </Aviso>
      )}

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
