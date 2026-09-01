import { ConnectionState } from 'livekit-client'
import type { Aba } from '../../sala/lateral'
import {
  IconeAjustesDaTela,
  IconeCerto,
  IconeChat,
  IconeConvite,
  IconeMetricas,
  IconePainel,
  IconePessoas,
} from '../../ui/Icone'
import estilos from './Cabecalho.module.css'

interface Props {
  nomeDaSala: string
  conexao: ConnectionState
  pessoas: number
  /** Abre e fecha a barra lateral de pessoas e telas. */
  aoAlternarLateral(): void
  lateralAberta: boolean
  /** A aba que a gaveta está mostrando agora, ou `null` com ela fechada. */
  abaAMostra: Aba | null
  aoAlternarAba(aba: Aba): void
  transmitindo: boolean
  naoLidasNoChat: number
  /** `true` durante os 1,6 s em que o convite já foi copiado. */
  conviteCopiado: boolean
  aoCopiarConvite(): void
}

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'conectando…',
  [ConnectionState.Reconnecting]: 'reconectando…',
  [ConnectionState.SignalReconnecting]: 'reconectando…',
  [ConnectionState.Disconnected]: 'desconectado',
}

/** O topo persistente da sala: onde você está, quem está junto e os painéis. */
export function Cabecalho({
  nomeDaSala,
  conexao,
  pessoas,
  aoAlternarLateral,
  lateralAberta,
  abaAMostra,
  aoAlternarAba,
  transmitindo,
  naoLidasNoChat,
  conviteCopiado,
  aoCopiarConvite,
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
        <IconePainel tamanho={18} />
        <IconePessoas tamanho={16} />
        <span className={estilos.contagem}>{pessoas}</span>
      </button>

      <span className={estilos.separador} aria-hidden="true" />

      <span className={estilos.nomeDaSala}>{nomeDaSala}</span>
      <span className={estilos.efemera}>efêmera</span>

      <span className={estilos.espacador} />

      <span className={estilos.estado} data-conectado={conectada || undefined}>
        <span className={estilos.pulso} aria-hidden="true" />
        {frase}
      </span>

      <button
        type="button"
        className={estilos.botao}
        aria-label={conviteCopiado ? 'Convite copiado!' : 'Copiar convite'}
        title={conviteCopiado ? 'Convite copiado!' : 'Copiar convite'}
        onClick={aoCopiarConvite}
      >
        {conviteCopiado ? <IconeCerto tamanho={18} /> : <IconeConvite tamanho={18} />}
      </button>

      {/* Os ajustes da tela só existem enquanto há tela sua no ar — é o único momento em que o
          painel de qualidade tem o que dizer. */}
      {transmitindo && (
        <button
          type="button"
          className={estilos.botao}
          aria-pressed={abaAMostra === 'qualidade'}
          aria-label="Qualidade da transmissão"
          title="Qualidade da transmissão"
          onClick={() => aoAlternarAba('qualidade')}
        >
          <IconeAjustesDaTela tamanho={20} />
        </button>
      )}

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

      <button
        type="button"
        className={estilos.botao}
        aria-pressed={abaAMostra === 'chat'}
        aria-label="Conversa"
        title="Conversa"
        onClick={() => aoAlternarAba('chat')}
      >
        <IconeChat tamanho={18} />
        {naoLidasNoChat > 0 && (
          <span className={estilos.contador} aria-label={`${naoLidasNoChat} mensagens não lidas`}>
            {naoLidasNoChat}
          </span>
        )}
      </button>
    </header>
  )
}
