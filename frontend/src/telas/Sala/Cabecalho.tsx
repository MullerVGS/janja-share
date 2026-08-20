import { ConnectionState } from 'livekit-client'
import { IconePainel } from '../../ui/Icone'
import estilos from './Cabecalho.module.css'

interface Props {
  nomeDaSala: string
  conexao: ConnectionState
  pessoas: number
  gavetaAberta: boolean
  aoAlternarGaveta(): void
}

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'Conectando…',
  [ConnectionState.Reconnecting]: 'Reconectando…',
  [ConnectionState.SignalReconnecting]: 'Reconectando…',
  [ConnectionState.Disconnected]: 'Desconectado.',
}

/**
 * O cabeçalho flutuante: onde você está, quantos são e a porta do painel. Nada aqui é moldura —
 * ele vive por cima do palco e some junto com o resto da interface.
 */
export function Cabecalho({ nomeDaSala, conexao, pessoas, gavetaAberta, aoAlternarGaveta }: Props) {
  const frase = FRASE_DA_CONEXAO[conexao]

  return (
    <header className={estilos.cabecalho}>
      <span
        className={estilos.pulso}
        data-conectado={conexao === ConnectionState.Connected || undefined}
        aria-hidden="true"
      />
      <span className={estilos.nomeDaSala}>{nomeDaSala}</span>
      <span className={estilos.estado}>{frase ?? `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`}</span>

      <button
        type="button"
        className={estilos.botao}
        aria-pressed={gavetaAberta}
        aria-label={gavetaAberta ? 'Fechar o painel' : 'Abrir o painel'}
        onClick={aoAlternarGaveta}
      >
        <IconePainel tamanho={17} />
      </button>
    </header>
  )
}
