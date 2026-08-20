import { useEffect, useMemo, useState } from 'react'
import { ConnectionState } from 'livekit-client'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { alternarAba, type Aba, type EstadoDaLateral } from '../../sala/lateral'
import { montarPalco } from '../../sala/palco'
import { useChat } from '../../sala/useChat'
import { useCompartilhamento } from '../../sala/useCompartilhamento'
import { useSala } from '../../sala/useSala'
import { useVolumes } from '../../sala/useVolumes'
import { useSessao } from '../../sessao/sessao'
import { ultima } from '../../telemetria/historico'
import { useTelemetria } from '../../telemetria/useTelemetria'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import type { Ajuste } from './assistir'
import { Chat } from './Chat'
import { Controles } from './Controles'
import { Gaveta } from './Gaveta'
import { AudioDaSala } from './Midia'
import { Palco } from './Palco'
import { Qualidade } from './Qualidade'
import { resumirTransmissao } from './resumo'
import { Transmissao } from './Transmissao'
import estilos from './Sala.module.css'

const FRASE_DA_CONEXAO: Partial<Record<ConnectionState, string>> = {
  [ConnectionState.Connecting]: 'Conectando…',
  [ConnectionState.Reconnecting]: 'Reconectando…',
  [ConnectionState.SignalReconnecting]: 'Reconectando…',
  [ConnectionState.Disconnected]: 'Desconectado.',
}

export function Sala() {
  const { slug = '' } = useParams()
  const { credenciaisDe, encerrar } = useSessao()
  const credenciais = credenciaisDe(slug)
  const navegar = useNavigate()
  const { sala, conexao, erro, versao, audioLiberado, liberarAudio } = useSala(credenciais)
  const telemetria = useTelemetria(sala)
  const compartilhamento = useCompartilhamento(sala, telemetria.emissor)
  // O chat vive aqui, e não dentro de <Chat>: fechar o painel desmontava o componente, o hook
  // ia junto, o ouvinte de DataReceived era removido e a conversa inteira sumia — reabrir
  // mostrava "Nada dito ainda." enquanto os outros continuavam falando.
  const chat = useChat(sala, credenciais?.nome ?? '')
  // Um só mapa de volumes na sala: o controle está no quadro e o som sai do `AudioDaSala`.
  const volumes = useVolumes()

  const [fixada, setFixada] = useState<string | null>(null)
  const [preferencias] = useState(lerPreferencias)
  const [ajuste, setAjuste] = useState<Ajuste>(preferencias.ajuste)
  const [lateral, setLateral] = useState<EstadoDaLateral>({ aberta: true, aba: preferencias.abaDaLateral })
  const [larguraDaLateral, setLarguraDaLateral] = useState(preferencias.larguraDaLateral)
  const [lidasNoChat, setLidasNoChat] = useState(0)
  const [erroDeDispositivo, setErroDeDispositivo] = useState<string | null>(null)

  // O palco é derivado do `Room`; `versao` é o que diz que ele mudou.
  const palco = useMemo(() => montarPalco(sala), [sala, versao])
  const amostraDoEmissor = ultima(telemetria.emissor)

  // Mostrar é automático (o app decide, não persiste); escolher é a pessoa clicando, e fica.
  function mostrarAba(aba: Aba) {
    setLateral({ aberta: true, aba })
  }

  function escolherAba(aba: Aba) {
    mostrarAba(aba)
    gravarPreferencias({ abaDaLateral: aba })
  }

  function alternarLateral(aba: Aba) {
    const proximo = alternarAba(lateral, aba)
    setLateral(proximo)
    gravarPreferencias({ abaDaLateral: proximo.aba })
  }

  function escolherAjuste(escolhido: Ajuste) {
    setAjuste(escolhido)
    gravarPreferencias({ ajuste: escolhido })
  }

  function redimensionarLateral(largura: number) {
    setLarguraDaLateral(largura)
    gravarPreferencias({ larguraDaLateral: largura })
  }

  // Começar a compartilhar abre a aba de qualidade: é exatamente o momento em que ela tem o
  // que dizer, e deixá-la escondida faria o ajuste virar um segredo do app.
  useEffect(() => {
    if (compartilhamento.ativo) mostrarAba('qualidade')
  }, [compartilhamento.ativo])

  // Não lidas = o que chegou enquanto o chat não estava à mostra. Com ele à mostra, tudo é lido.
  const chatVisivel = lateral.aberta && lateral.aba === 'chat'
  useEffect(() => {
    if (chatVisivel) setLidasNoChat(chat.mensagens.length)
  }, [chatVisivel, chat.mensagens.length])
  const naoLidasNoChat = chatVisivel ? 0 : Math.max(0, chat.mensagens.length - lidasNoChat)

  // A tela fixada pode sair do ar a qualquer momento; o foco não pode ficar apontando para o vazio.
  useEffect(() => {
    if (fixada !== null && !palco.telas.some((tela) => tela.chave === fixada)) setFixada(null)
  }, [fixada, palco.telas])

  // Sala com senha exige passar pela porta de novo — sem credenciais guardadas para este slug,
  // não há tela intermediária de aviso, só a volta silenciosa para o início.
  if (!credenciais) return <Navigate to="/" replace />

  const frase = FRASE_DA_CONEXAO[conexao]
  const nomeDe = (identidade: string) =>
    palco.pessoas.find((pessoa) => pessoa.identidade === identidade)?.nome ?? identidade

  function sair() {
    encerrar(slug)
    navegar('/', { replace: true })
  }

  return (
    <div className={estilos.sala}>
      <header className={estilos.topo}>
        <span className={estilos.marca}>share</span>
        <span className={estilos.nomeDaSala}>{credenciais.nomeDaSala}</span>
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
          <Palco
            palco={palco}
            fixada={fixada}
            aoFixar={setFixada}
            volumes={volumes}
            ajuste={ajuste}
            aoAjustar={escolherAjuste}
          />
        </main>

        <Gaveta
          aberta={lateral.aberta}
          aba={lateral.aba}
          aoTrocarAba={escolherAba}
          transmitindo={compartilhamento.ativo}
          largura={larguraDaLateral}
          aoRedimensionar={redimensionarLateral}
          naoLidasNoChat={naoLidasNoChat}
          resumo={
            compartilhamento.ativo
              ? resumirTransmissao(amostraDoEmissor, compartilhamento.relatorio, {
                  pedido: compartilhamento.perfil,
                  estado: compartilhamento.governador,
                })
              : null
          }
          qualidade={<Qualidade compartilhamento={compartilhamento} />}
          transmissao={
            <Transmissao
              telemetria={telemetria}
              perfilEfetivo={compartilhamento.perfilEfetivo}
              decisoes={compartilhamento.governador.decisoes}
              nomeDe={nomeDe}
            />
          }
          chat={<Chat chat={chat} />}
        />
      </div>

      <Controles
        sala={sala}
        compartilhamento={compartilhamento}
        abaAberta={lateral.aberta ? lateral.aba : null}
        aoAlternarAba={alternarLateral}
        aoFalhar={setErroDeDispositivo}
        aoSair={sair}
      />

      <AudioDaSala sala={sala} volumes={volumes} />
    </div>
  )
}
