import { ConnectionState } from 'livekit-client'
import type { Peca } from '../../sala/palco'
import { Avatar } from '../../ui/Avatar'
import { Botao } from '../../ui/Botao'
import {
  IconeCerto,
  IconeConvite,
  IconeFalando,
  IconeMicrofone,
  IconeMicrofoneMudo,
  IconePainel,
  IconeSair,
  IconeTelaNoAr,
} from '../../ui/Icone'
import estilos from './NavegacaoDaSala.module.css'

interface Props {
  nomeDaSala: string
  nomeDaPessoa: string
  conexao: ConnectionState
  pessoas: Peca[]
  telas: Peca[]
  /** A chave do quadro em destaque — a linha da tela que está no palco fica acesa. */
  emDestaque: string | null
  aoFocar(chave: string): void
  aberta: boolean
  aoRecolher(): void
  conviteCopiado: boolean
  aoCopiarConvite(): void
  aoSair(): void
}

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'conectando…',
  [ConnectionState.Reconnecting]: 'reconectando…',
  [ConnectionState.SignalReconnecting]: 'reconectando…',
  [ConnectionState.Disconnected]: 'desconectado',
}

function frasePlural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

function PessoaNaSala({ pessoa }: { pessoa: Peca }) {
  const dica = pessoa.falando ? 'falando' : pessoa.microfoneLigado ? 'microfone aberto' : 'microfone fechado'
  return (
    <li className={estilos.pessoa}>
      <Avatar nome={pessoa.nome} tamanho="pequeno" falando={pessoa.falando} proprio={pessoa.proprio} />
      <span className={estilos.nomeDaPessoa}>{pessoa.nome}</span>
      {pessoa.proprio && <span className={estilos.voce}>você</span>}
      <span className={estilos.microfone} data-aberto={pessoa.microfoneLigado || undefined} title={dica}>
        {pessoa.falando ? (
          <IconeFalando tamanho={14} />
        ) : pessoa.microfoneLigado ? (
          <IconeMicrofone tamanho={14} />
        ) : (
          <IconeMicrofoneMudo tamanho={14} />
        )}
      </span>
    </li>
  )
}

/**
 * A barra lateral: quem está na sala e o que está no ar.
 *
 * As duas listas respondem perguntas diferentes — presença e imagem — e por isso não são a
 * mesma: uma pessoa aparece uma vez na de cima esteja ela compartilhando ou não, e cada tela no
 * ar é uma linha clicável que põe aquela imagem no palco.
 *
 * O convite fica no topo porque é a primeira coisa que se faz numa sala recém-criada, e a saída
 * fica no rodapé, junto de quem você é — as duas pontas do "estou aqui".
 */
export function NavegacaoDaSala({
  nomeDaSala,
  nomeDaPessoa,
  conexao,
  pessoas,
  telas,
  emDestaque,
  aoFocar,
  aberta,
  aoRecolher,
  conviteCopiado,
  aoCopiarConvite,
  aoSair,
}: Props) {
  const conectada = conexao === ConnectionState.Connected
  const estadoDaConexao = conectada ? 'conectado à sala' : (FRASE_DA_CONEXAO[conexao] ?? 'conectando…')

  return (
    <nav
      className={estilos.navegacao}
      aria-label="Pessoas e telas da sala"
      data-aberta={aberta || undefined}
      aria-hidden={aberta ? undefined : true}
      inert={!aberta}
    >
      <header className={estilos.cabecalho}>
        <span className={estilos.identificacao}>
          <span className={estilos.nomeDaSala}>{nomeDaSala}</span>
          <span className={estilos.subtitulo}>
            sala efêmera ·{' '}
            <span className={estilos.telasNoAr}>{frasePlural(telas.length, 'tela no ar', 'telas no ar')}</span>
          </span>
        </span>
        <button
          type="button"
          className={estilos.recolher}
          aria-label="Recolher painel"
          title="Recolher painel"
          onClick={aoRecolher}
        >
          <IconePainel tamanho={17} />
        </button>
      </header>

      <div className={estilos.convite}>
        <Botao aparencia="primario" blocoInteiro onClick={aoCopiarConvite}>
          {conviteCopiado ? <IconeCerto tamanho={16} /> : <IconeConvite tamanho={16} />}
          {conviteCopiado ? 'Convite copiado' : 'Copiar convite'}
        </Botao>
      </div>

      <div className={estilos.rolagem}>
        <h2 className={estilos.tituloDoGrupo}>Na sala · {pessoas.length}</h2>
        <ul className={estilos.lista}>
          {pessoas.map((pessoa) => (
            <PessoaNaSala key={pessoa.chave} pessoa={pessoa} />
          ))}
        </ul>

        {telas.length > 0 && (
          <>
            <h2 className={estilos.tituloDoGrupo}>Telas no ar · {telas.length}</h2>
            <ul className={estilos.lista}>
              {telas.map((tela) => (
                <li key={tela.chave}>
                  <button
                    type="button"
                    className={estilos.tela}
                    data-ativa={tela.chave === emDestaque || undefined}
                    onClick={() => aoFocar(tela.chave)}
                  >
                    <IconeTelaNoAr tamanho={16} />
                    <span className={estilos.rotuloDaTela}>{tela.proprio ? 'Sua tela' : `Tela de ${tela.nome}`}</span>
                    <span className={estilos.pontoAoVivo} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <footer className={estilos.identidade}>
        <Avatar nome={nomeDaPessoa} tamanho="medio" proprio />
        <span className={estilos.identidadeTexto}>
          <strong>{nomeDaPessoa}</strong>
          <span className={estilos.estadoDaConexao} data-conectado={conectada || undefined}>
            <span className={estilos.pontoDaConexao} aria-hidden="true" />
            {estadoDaConexao}
          </span>
        </span>
        <button
          type="button"
          className={estilos.sair}
          aria-label="Sair da sala"
          title="Sair da sala"
          onClick={aoSair}
        >
          <IconeSair tamanho={16} />
        </button>
      </footer>
    </nav>
  )
}
