import { FRASE_DA_LIMITACAO, formatarKbps } from '../../sala/medidor'
import {
  OPCOES_DE_FPS,
  PRIORIDADES,
  RESOLUCOES,
  TETO,
  trocarPrioridade,
  type PerfilDeQualidade,
  type Prioridade,
  type Resolucao,
} from '../../sala/qualidade'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import { Segmentado, type OpcaoSegmentada } from '../../ui/Segmentado'
import estilos from './PainelDeQualidade.module.css'

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

const OPCOES_DE_PRIORIDADE: OpcaoSegmentada<Prioridade>[] = (
  Object.keys(PRIORIDADES) as Prioridade[]
).map((valor) => ({ valor, rotulo: PRIORIDADES[valor].rotulo, descricao: PRIORIDADES[valor].explicacao }))

/**
 * O painel que ajusta a transmissão de tela ao vivo.
 *
 * Cada controle vale no ato: nada aqui republica a faixa nem derruba quem está assistindo. E
 * tudo o que ele muda aparece no medidor logo abaixo — a ideia é a pessoa *ver* o efeito de
 * baixar o FPS ou apertar o teto, em vez de mexer no escuro e torcer.
 */
export function PainelDeQualidade({ compartilhamento }: { compartilhamento: Compartilhamento }) {
  const { perfil, definirPerfil, medida, relatorio, ativo } = compartilhamento
  const ajustar = (parcial: Partial<PerfilDeQualidade>) => definirPerfil({ ...perfil, ...parcial })
  const prioridade = PRIORIDADES[perfil.prioridade]

  return (
    <section className={estilos.painel} aria-label="Qualidade da tela">
      <header className={estilos.cabecalho}>
        <h2 className={estilos.titulo}>Qualidade da tela</h2>
        {!ativo && <span className={estilos.dica}>vale no próximo compartilhamento</span>}
      </header>

      <Segmentado
        rotulo="Resolução"
        opcoes={OPCOES_DE_RESOLUCAO}
        valor={perfil.resolucao}
        aoEscolher={(resolucao) => ajustar({ resolucao })}
      />

      <Segmentado rotulo="FPS" opcoes={OPCOES_FPS} valor={perfil.fps} aoEscolher={(fps) => ajustar({ fps })} />

      <div className={estilos.prioridade}>
        <Segmentado
          rotulo="Prioridade"
          opcoes={OPCOES_DE_PRIORIDADE}
          valor={perfil.prioridade}
          aoEscolher={(escolhida) => definirPerfil(trocarPrioridade(perfil, escolhida))}
        />
        <p className={estilos.explicacao}>{prioridade.explicacao}</p>
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

      <div className={estilos.medidor} data-ativo={ativo || undefined}>
        <div className={estilos.leitura}>
          <span className={estilos.numero}>{formatarKbps(medida.kbps)}</span>
          <span className={estilos.legenda}>saindo agora</span>
        </div>
        <div className={estilos.leitura}>
          <span className={estilos.numero}>{medida.fps === null ? '—' : `${medida.fps} fps`}</span>
          <span className={estilos.legenda}>codificados</span>
        </div>
        <div className={estilos.leitura}>
          <span className={estilos.numero}>
            {medida.altura === null ? '—' : `${medida.largura ?? '?'}×${medida.altura}`}
          </span>
          <span className={estilos.legenda}>saída real</span>
        </div>
      </div>

      {medida.limitadoPor && (
        <p className={estilos.limitacao} role="status">
          {FRASE_DA_LIMITACAO[medida.limitadoPor]} — o encoder está cedendo{' '}
          {perfil.prioridade === 'nitidez' ? 'quadros' : 'resolução'} para caber.
        </p>
      )}

      {relatorio?.captura === 'recusado' && (
        <p className={estilos.recusa} role="status">
          A captura recusou este ajuste{relatorio.falhaDaCaptura ? `: ${relatorio.falhaDaCaptura}` : ''}. A fonte
          compartilhada não entrega mais que isso — o teto e a prioridade continuam valendo.
        </p>
      )}

      {/* Recusa do encoder é mais grave que a da captura: o slider mostra o valor novo, mas o
          que está no ar continua sendo o anterior. Sem este aviso, o painel mentiria. */}
      {relatorio?.encoder === 'recusado' && (
        <p className={estilos.recusaGrave} role="alert">
          O encoder recusou este ajuste{relatorio.falhaDoEncoder ? `: ${relatorio.falhaDoEncoder}` : ''}. O teto e a
          prioridade que estão no ar ainda são os anteriores — mexa em qualquer controle para tentar de novo.
        </p>
      )}
    </section>
  )
}
