import { useEffect, useMemo, useState } from 'react'
import { ConnectionState } from 'livekit-client'
import { Link, useNavigate } from 'react-router-dom'
import { montarPalco } from '../../sala/palco'
import { useChat } from '../../sala/useChat'
import { useCompartilhamento } from '../../sala/useCompartilhamento'
import { useSala } from '../../sala/useSala'
import { useSessao } from '../../sessao/sessao'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Chat } from './Chat'
import { Controles } from './Controles'
import { AudioDaSala } from './Midia'
import { PainelDeQualidade } from './PainelDeQualidade'
import { Palco } from './Palco'
import entrada from '../Entrada.module.css'
import estilos from './Sala.module.css'

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'Conectando…',
  [ConnectionState.Reconnecting]: 'Reconectando…',
  [ConnectionState.SignalReconnecting]: 'Reconectando…',
  [ConnectionState.Disconnected]: 'Desconectado.',
}

export function Sala() {
  const { credenciais, encerrar } = useSessao()
  const navegar = useNavigate()
  const { sala, conexao, erro, versao, audioLiberado, liberarAudio } = useSala(credenciais)
  const compartilhamento = useCompartilhamento(sala)
  // O chat vive aqui, e não dentro de <Chat>: fechar o painel desmontava o componente, o hook
  // ia junto, o ouvinte de DataReceived era removido e a conversa inteira sumia — reabrir
  // mostrava "Nada dito ainda." enquanto os outros continuavam falando.
  const chat = useChat(sala, credenciais?.nome ?? '')

  const [fixada, setFixada] = useState<string | null>(null)
  const [chatAberto, setChatAberto] = useState(true)
  const [painelAberto, setPainelAberto] = useState(false)
  const [erroDeDispositivo, setErroDeDispositivo] = useState<string | null>(null)

  // O palco é derivado do `Room`; `versao` é o que diz que ele mudou.
  const palco = useMemo(() => montarPalco(sala), [sala, versao])

  // Começar a compartilhar abre o painel de qualidade: é exatamente o momento em que ele tem
  // o que dizer, e deixá-lo escondido faria o ajuste virar um segredo do app.
  useEffect(() => {
    if (compartilhamento.ativo) setPainelAberto(true)
  }, [compartilhamento.ativo])

  // A tela fixada pode sair do ar a qualquer momento; o foco não pode ficar apontando para o vazio.
  useEffect(() => {
    if (fixada !== null && !palco.telas.some((tela) => tela.chave === fixada)) setFixada(null)
  }, [fixada, palco.telas])

  if (!credenciais) {
    return (
      <div className={entrada.tela}>
        <div className={entrada.caixa}>
          <div className={entrada.marca}>share</div>
          <div className={entrada.cartao}>
            <h1 className={entrada.titulo}>Sua sessão não está mais aqui</h1>
            <p className={entrada.legenda}>
              A sessão sobrevive a um F5, mas morre quando a aba fecha — e o passe da sala tem prazo.
              Abra o link de convite de novo para voltar.
            </p>
            <Link to="/">Voltar ao início</Link>
          </div>
        </div>
      </div>
    )
  }

  const lateralAberta = chatAberto || painelAberto
  const frase = FRASE_DA_CONEXAO[conexao]

  function sair() {
    encerrar()
    navegar('/', { replace: true })
  }

  return (
    <div className={estilos.sala}>
      <header className={estilos.topo}>
        <span className={estilos.marca}>share</span>
        <span className={estilos.nomeDaSala}>{credenciais.sala}</span>
        <span
          className={estilos.pulso}
          data-conectado={conexao === ConnectionState.Connected || undefined}
          aria-hidden="true"
        />
        <span className={estilos.estado}>
          {frase ?? `${palco.pessoas.length} ${palco.pessoas.length === 1 ? 'pessoa' : 'pessoas'}`}
        </span>
        <span className={estilos.espaco} />
        <span className={estilos.eu}>{credenciais.nome}</span>
      </header>

      {erro && (
        <div className={estilos.faixaDeErro}>
          <Aviso tom="erro">Não foi possível conectar à sala: {erro}</Aviso>
        </div>
      )}

      {!audioLiberado && (
        <div className={estilos.faixaDeErro}>
          <Aviso tom="neutro">
            O navegador está segurando o áudio até você interagir com a página.{' '}
            <Botao aparencia="fantasma" onClick={liberarAudio}>
              Ouvir a sala
            </Botao>
          </Aviso>
        </div>
      )}

      {compartilhamento.erro && (
        <div className={estilos.faixaDeErro}>
          <Aviso tom="erro">{compartilhamento.erro}</Aviso>
        </div>
      )}

      {erroDeDispositivo && (
        <div className={estilos.faixaDeErro}>
          <Aviso tom="erro">{erroDeDispositivo}</Aviso>
        </div>
      )}

      <div className={estilos.corpo}>
        <main className={estilos.centro}>
          <Palco palco={palco} fixada={fixada} aoFixar={setFixada} />
        </main>

        {lateralAberta && (
          <aside className={estilos.lateral}>
            {painelAberto && <PainelDeQualidade compartilhamento={compartilhamento} />}
            {chatAberto && <Chat chat={chat} />}
          </aside>
        )}
      </div>

      <Controles
        sala={sala}
        compartilhamento={compartilhamento}
        chatAberto={chatAberto}
        painelAberto={painelAberto}
        alternarChat={() => setChatAberto((aberto) => !aberto)}
        alternarPainel={() => setPainelAberto((aberto) => !aberto)}
        aoFalhar={setErroDeDispositivo}
        aoSair={sair}
      />

      <AudioDaSala sala={sala} />
    </div>
  )
}
