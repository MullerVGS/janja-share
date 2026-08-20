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

/**
 * A aba que ajusta a transmissão de tela ao vivo.
 *
 * Cada controle vale no ato e sem derrubar quem assiste — exceto o codec, que republica a
 * faixa e pisca por um segundo. O efeito de cada ajuste aparece na barra de resumo logo acima
 * e na aba Transmissão: a ideia é a pessoa *ver* o que baixar o FPS ou apertar o teto faz.
 */
export function Qualidade({ compartilhamento }: { compartilhamento: Compartilhamento }) {
  const { perfil, definirPerfil, relatorio, ativo } = compartilhamento
  const ajustar = (parcial: Partial<PerfilDeQualidade>) => definirPerfil({ ...perfil, ...parcial })

  return (
    <section className={estilos.aba} aria-label="Qualidade da tela">
      <header className={estilos.cabecalho}>
        <h2 className={estilos.titulo}>Qualidade da tela</h2>
        {!ativo && <span className={estilos.dica}>vale no próximo compartilhamento</span>}
      </header>

      <Segmentado
        rotulo="Conteúdo"
        opcoes={OPCOES_DE_CONTEUDO}
        valor={perfil.conteudo}
        aoEscolher={(conteudo) => definirPerfil(trocarConteudo(perfil, conteudo))}
      />

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
          Teto de bitrate
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
