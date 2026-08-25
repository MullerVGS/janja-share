import { useEffect, useState } from 'react'
import { ConnectionState } from 'livekit-client'
import { IconeCerto, IconeCopiar, IconePainel, IconePessoas } from '../../ui/Icone'
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

/** O topo persistente da sala: localização, presença, link e acesso ao painel lateral. */
export function Cabecalho({ nomeDaSala, conexao, pessoas, gavetaAberta, aoAlternarGaveta }: Props) {
  const frase = FRASE_DA_CONEXAO[conexao]
  const [linkCopiado, setLinkCopiado] = useState(false)

  // "Copiado!" dura 2 s — o mesmo prazo do "Copiado" da aba Transmissão.
  useEffect(() => {
    if (!linkCopiado) return
    const volta = setTimeout(() => setLinkCopiado(false), 2000)
    return () => clearTimeout(volta)
  }, [linkCopiado])

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopiado(true)
    } catch {
      // Sem permissão ou sem a API: a URL já está na barra de endereço, ninguém fica sem saída.
    }
  }

  return (
    <header className={estilos.cabecalho}>
      <span className={estilos.canal} aria-hidden="true">
        #
      </span>
      <span className={estilos.nomeDaSala}>{nomeDaSala}</span>
      <span className={estilos.separador} aria-hidden="true" />
      <span
        className={estilos.pulso}
        data-conectado={conexao === ConnectionState.Connected || undefined}
        aria-hidden="true"
      />
      <span className={estilos.estado}>
        {!frase && <IconePessoas tamanho={15} />}
        {frase ?? `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`}
      </span>

      <span className={estilos.espacador} />

      <button
        type="button"
        className={estilos.botao}
        aria-label={linkCopiado ? 'Link copiado!' : 'Copiar link'}
        title={linkCopiado ? 'Link copiado!' : 'Copiar link'}
        onClick={() => void copiarLink()}
      >
        {linkCopiado ? <IconeCerto tamanho={17} /> : <IconeCopiar tamanho={17} />}
      </button>

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
