import { ConnectionState } from 'livekit-client'
import type { Aba } from '../../sala/lateral'
import { fraseDaGuarda } from '../../salas/link'
import {
  IconeCerto,
  IconeConvite,
  IconeEditar,
  IconeMetricas,
  IconePessoas,
  IconeRecarregar,
} from '../../ui/Icone'
import estilos from './Cabecalho.module.css'

interface Props {
  nomeDaSala: string
  /** Fixa fica guardada depois que todos saem; a efêmera some. Ausente é efêmera. */
  fixa?: boolean
  /** Abre o ajuste de nome e visibilidade. Sem ele, o botão não aparece. */
  aoAjustar?(): void
  conexao: ConnectionState
  pessoas: number
  /** Abre e fecha a barra lateral de pessoas e telas. */
  aoAlternarLateral(): void
  lateralAberta: boolean
  /** A aba que a gaveta está mostrando agora, ou `null` com ela fechada. */
  abaAMostra: Aba | null
  aoAlternarAba(aba: Aba): void
  /** `true` durante os 1,6 s em que o convite já foi copiado. */
  conviteCopiado: boolean
  aoCopiarConvite(): void
  /** Reassina tudo o que a pessoa assiste, sem sair da Sala — o conserto no lugar do F5. */
  aoRecarregarMidia(): void
}

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'conectando…',
  [ConnectionState.Reconnecting]: 'reconectando…',
  [ConnectionState.SignalReconnecting]: 'reconectando…',
  [ConnectionState.Disconnected]: 'desconectado',
}

/**
 * O topo persistente da sala: onde você está, quem está junto, o convite e as métricas.
 *
 * Chat e qualidade moram só na barra de baixo: o mesmo botão em dois lugares é mais um ícone
 * para decifrar, e não mais um caminho. As abas da gaveta ligam um painel ao outro.
 */
export function Cabecalho({
  nomeDaSala,
  fixa = false,
  aoAjustar,
  conexao,
  pessoas,
  aoAlternarLateral,
  lateralAberta,
  abaAMostra,
  aoAlternarAba,
  conviteCopiado,
  aoCopiarConvite,
  aoRecarregarMidia,
}: Props) {
  const conectada = conexao === ConnectionState.Connected
  const frase = conectada ? 'conectado' : (FRASE_DA_CONEXAO[conexao] ?? 'conectando…')

  return (
    <header className={estilos.cabecalho}>
      <button
        type="button"
        className={estilos.pessoas}
        aria-pressed={lateralAberta}
        aria-label="Pessoas e telas"
        title="Pessoas e telas"
        onClick={aoAlternarLateral}
      >
        <IconePessoas tamanho={18} />
        <span className={estilos.contagem}>{pessoas}</span>
      </button>

      <span className={estilos.separador} aria-hidden="true" />

      <span className={estilos.nomeDaSala}>{nomeDaSala}</span>
      {aoAjustar && (
        <button
          type="button"
          className={estilos.ajustar}
          aria-label="Mudar nome ou visibilidade"
          title="Mudar nome ou visibilidade"
          onClick={aoAjustar}
        >
          <IconeEditar tamanho={15} />
        </button>
      )}
      <span className={estilos.efemera} title={fraseDaGuarda(fixa)}>
        {fixa ? 'fixa' : 'efêmera'}
      </span>

      <span className={estilos.espacador} />

      <span className={estilos.estado} data-conectado={conectada || undefined}>
        <span className={estilos.pulso} aria-hidden="true" />
        {frase}
      </span>

      {/* Ao lado do estado da conexão, que é onde se olha quando algo não chega. Só faz sentido
          conectado: caída, quem religa é a sala. */}
      <button
        type="button"
        className={estilos.botao}
        aria-label="Recarregar mídia"
        title="Recarregar mídia: busca de novo as telas e o som, sem sair da sala"
        disabled={!conectada}
        onClick={aoRecarregarMidia}
      >
        <IconeRecarregar tamanho={18} />
      </button>

      {/* O convite leva a palavra junto do ícone: é a primeira coisa que se faz numa sala nova. */}
      <button
        type="button"
        className={estilos.convite}
        aria-label={conviteCopiado ? 'Convite copiado!' : 'Copiar convite'}
        title={conviteCopiado ? 'Convite copiado!' : 'Copiar convite'}
        onClick={aoCopiarConvite}
      >
        {conviteCopiado ? <IconeCerto tamanho={18} /> : <IconeConvite tamanho={18} />}
        <span className={estilos.textoDoConvite}>{conviteCopiado ? 'Copiado!' : 'Convidar'}</span>
      </button>

      <button
        type="button"
        className={estilos.botao}
        aria-pressed={abaAMostra === 'metricas'}
        aria-label="Métricas da transmissão"
        title="Métricas da transmissão"
        onClick={() => aoAlternarAba('metricas')}
      >
        <IconeMetricas tamanho={18} />
      </button>
    </header>
  )
}
