import { useState } from 'react'
import { ConnectionState } from 'livekit-client'
import type { Peca } from '../../sala/palco'
import { Avatar } from '../../ui/Avatar'
import { iniciaisDoNome } from '../../ui/avatares'
import { IconeMicrofone, IconeMicrofoneMudo, IconePessoas, IconeSalaDeVoz, IconeTela } from '../../ui/Icone'
import { ItemDoTrilho, Trilho } from '../../ui/Trilho'
import estilos from './NavegacaoDaSala.module.css'

interface Props {
  nomeDaSala: string
  nomeDaPessoa: string
  conexao: ConnectionState
  pessoas: Peca[]
  telas: Peca[]
  aoVoltar(): void
}

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'conectando…',
  [ConnectionState.Reconnecting]: 'reconectando…',
  [ConnectionState.SignalReconnecting]: 'reconectando…',
  [ConnectionState.Disconnected]: 'desconectado',
}

function PessoaNaSala({ pessoa }: { pessoa: Peca }) {
  return (
    <li className={estilos.pessoa} data-falando={pessoa.falando || undefined}>
      <Avatar nome={pessoa.nome} tamanho="pequeno" status={pessoa.falando ? 'falando' : undefined} />
      <span className={estilos.nomeDaPessoa}>
        {pessoa.nome}
        {pessoa.proprio && <span className={estilos.voce}>você</span>}
      </span>
      <span
        className={pessoa.microfoneLigado ? estilos.microfone : estilos.microfoneFechado}
        title={pessoa.microfoneLigado ? 'microfone aberto' : 'microfone fechado'}
      >
        {pessoa.microfoneLigado ? <IconeMicrofone tamanho={14} /> : <IconeMicrofoneMudo tamanho={14} />}
      </span>
    </li>
  )
}

export function NavegacaoDaSala({ nomeDaSala, nomeDaPessoa, conexao, pessoas, telas, aoVoltar }: Props) {
  const conectada = conexao === ConnectionState.Connected
  const [canaisAbertos, setCanaisAbertos] = useState(false)
  const estadoDaConexao = conectada ? 'conectado à sala' : (FRASE_DA_CONEXAO[conexao] ?? 'conectando…')

  return (
    <nav
      className={estilos.navegacao}
      aria-label="Navegação da sala"
      data-canais-abertos={canaisAbertos || undefined}
    >
      <div className={estilos.trilho}>
        <Trilho aoClicarNaMarca={aoVoltar} rotuloDaMarca="Voltar ao saguão">
          <ItemDoTrilho className={estilos.salaAtual} rotulo={`Sala ${nomeDaSala}`} ativo>
            {iniciaisDoNome(nomeDaSala)}
          </ItemDoTrilho>
          <span className={estilos.estadoDoTrilho} data-conectado={conectada || undefined} aria-hidden="true" />
          <button
            type="button"
            className={estilos.abrirCanais}
            aria-label={canaisAbertos ? 'Fechar canais e pessoas' : 'Abrir canais e pessoas'}
            aria-expanded={canaisAbertos}
            aria-controls="painel-canais"
            onClick={() => setCanaisAbertos((abertos) => !abertos)}
          >
            <IconePessoas tamanho={20} />
          </button>
        </Trilho>
      </div>

      <div className={estilos.canais} id="painel-canais">
        <header className={estilos.cabecalho}>
          <span className={estilos.nomeDaSalaAgrupado}>
            <span className={estilos.nomeDaSala}>{nomeDaSala}</span>
            <span className={estilos.efemera}>sala efêmera</span>
          </span>
          <button
            type="button"
            className={estilos.fecharCanais}
            aria-label="Fechar canais e pessoas"
            onClick={() => setCanaisAbertos(false)}
          >
            ×
          </button>
        </header>

        <div className={estilos.rolagem}>
          <section className={estilos.grupo} aria-labelledby="titulo-voz">
            <h2 className={estilos.tituloDoGrupo} id="titulo-voz">
              Canais de voz
            </h2>
            <div className={estilos.canalAtivo}>
              <IconeSalaDeVoz tamanho={19} />
              <span>Sala ao vivo</span>
              <span className={estilos.contagem}>{pessoas.length}</span>
            </div>
            <ul className={estilos.listaDePessoas}>
              {pessoas.map((pessoa) => (
                <PessoaNaSala key={pessoa.chave} pessoa={pessoa} />
              ))}
            </ul>
          </section>

          {telas.length > 0 && (
            <section className={estilos.grupo} aria-labelledby="titulo-telas">
              <h2 className={estilos.tituloDoGrupo} id="titulo-telas">
                Compartilhamentos
              </h2>
              <ul className={estilos.listaDeTelas}>
                {telas.map((tela) => (
                  <li key={tela.chave} className={estilos.telaNoAr}>
                    <IconeTela tamanho={16} />
                    <span>{tela.proprio ? 'Sua tela' : `Tela de ${tela.nome}`}</span>
                    <span className={estilos.aoVivo}>ao vivo</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className={estilos.identidade}>
          <Avatar nome={nomeDaPessoa} tamanho="pequeno" status={conectada ? 'online' : undefined} />
          <span className={estilos.identidadeTexto}>
            <strong>{nomeDaPessoa}</strong>
            <span>{estadoDaConexao}</span>
          </span>
        </footer>
      </div>
    </nav>
  )
}
