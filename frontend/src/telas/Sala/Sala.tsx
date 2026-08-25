import { useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionState } from 'livekit-client'
import { useNavigate, useParams } from 'react-router-dom'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { retirarCaptura } from '../../sala/capturaPendente'
import { decidirFoco, FOCO_INICIAL, type EstadoDoFoco } from '../../sala/foco'
import { alternarAba, type Aba, type EstadoDaLateral } from '../../sala/lateral'
import { chavesDasTelasPublicadas, montarPalco } from '../../sala/palco'
import { useAutoOcultar } from '../../sala/useAutoOcultar'
import { useFocoDeTeclado } from '../../sala/useFocoDeTeclado'
import { useChat } from '../../sala/useChat'
import { useCompartilhamento } from '../../sala/useCompartilhamento'
import { useSala } from '../../sala/useSala'
import { useVolumes } from '../../sala/useVolumes'
import { useZoom } from '../../sala/useZoom'
import { useSessao } from '../../sessao/sessao'
import { ultima } from '../../telemetria/historico'
import { useTelemetria } from '../../telemetria/useTelemetria'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Cabecalho } from './Cabecalho'
import { Chat } from './Chat'
import { Controles } from './Controles'
import { EntradaDaSala } from './EntradaDaSala'
import { Gaveta } from './Gaveta'
import { AudioDaSala } from './Midia'
import { NavegacaoDaSala } from './NavegacaoDaSala'
import { Palco } from './Palco'
import { Qualidade } from './Qualidade'
import { resumirTransmissao } from './resumo'
import { Tira } from './Tira'
import { Transmissao } from './Transmissao'
import estilos from './Sala.module.css'

/** A sala reúne navegação, palco e painéis sem misturar nenhum deles com o fluxo da mídia. */
export function Sala() {
  const { slug = '' } = useParams()
  const { credenciaisDe, guardar, encerrar } = useSessao()
  const credenciais = credenciaisDe(slug)
  const navegar = useNavigate()
  const { sala, conexao, erro, versao, audioLiberado, liberarAudio } = useSala(credenciais)
  const telemetria = useTelemetria(sala)
  const compartilhamento = useCompartilhamento(sala, telemetria.emissor, telemetria.espectadores)

  // A captura que a home abriu viaja por `capturaPendente`; adotá-la é o que faz o clique único
  // da home terminar em transmissão. Uma vez só — `retirarCaptura` é destrutivo.
  useEffect(() => {
    if (conexao !== ConnectionState.Connected) return
    const faixas = retirarCaptura()
    if (faixas) void compartilhamento.adotar(faixas)
  }, [conexao, compartilhamento])

  // Se a conexão falhou (SFU fora, credencial ruim), a sala nunca chega a `Connected` e o efeito
  // acima nunca roda — sem isto a captura só morreria pelo TTL de `capturaPendente`, 30s depois.
  // Ler `erro` não é cleanup: o StrictMode não atrapalha aqui, a invocação dupla do dev roda o
  // mesmo no-op duas vezes.
  useEffect(() => {
    if (erro) retirarCaptura()?.forEach((faixa) => faixa.stop())
  }, [erro])

  // O chat vive aqui, e não dentro de <Chat>: fechar o painel desmontava o componente, o hook
  // ia junto, o ouvinte de DataReceived era removido e a conversa inteira sumia — reabrir
  // mostrava "Nada dito ainda." enquanto os outros continuavam falando.
  const chat = useChat(sala, credenciais?.nome ?? '')
  // Um só mapa de volumes na sala: o controle está no quadro e o som sai do `AudioDaSala`.
  const volumes = useVolumes()

  const [preferencias] = useState(lerPreferencias)
  // A gaveta nasce fechada: nada de interface antes de alguém pedir.
  const [gaveta, setGaveta] = useState<EstadoDaLateral>({ aberta: false, aba: preferencias.abaDaLateral })
  const [larguraDaGaveta, setLarguraDaGaveta] = useState(preferencias.larguraDaLateral)
  const [lidasNoChat, setLidasNoChat] = useState(0)
  const [erroDeDispositivo, setErroDeDispositivo] = useState<string | null>(null)
  const [foco, setFoco] = useState<EstadoDoFoco>(FOCO_INICIAL)
  const interfaceFlutuante = useRef<HTMLDivElement>(null)

  // O palco é derivado do `Room`; `versao` é o que diz que ele mudou. `telemetria.recepcao`
  // entra à parte: o cão de guarda anda no relógio da telemetria, não no dos eventos do `Room`.
  const palco = useMemo(() => montarPalco(sala, telemetria.recepcao), [sala, versao, telemetria.recepcao])
  const telasPublicadas = useMemo(() => chavesDasTelasPublicadas(sala), [sala, versao])
  const pecas = useMemo(() => [...palco.telas, ...palco.pessoas], [palco])
  const zoom = useZoom(pecas)
  const amostraDoEmissor = ultima(telemetria.emissor)

  // Nunca some com a gaveta aberta ou com o teclado dentro da interface: sumir é para quem
  // largou o mouse parado, não para quem está no meio de alguma coisa.
  const focoDeTeclado = useFocoDeTeclado(interfaceFlutuante)
  const interfaceVisivel = useAutoOcultar(gaveta.aberta || focoDeTeclado)

  const telasAntes = useRef<string[]>([])
  useEffect(() => {
    // Enquanto `trocarDeTela` está no meio do unpublish+republish da própria tela, o palco pisca
    // sem a tela própria e volta a ter ela — não é uma mudança real.
    // Ignorar aqui (sem nem avançar `telasAntes.current`) evita o duplo efeito colateral: seria
    // expulsa do foco pela sumida, e roubada de volta pela heurística de "tela própria nova".
    if (compartilhamento.trocandoTela) return
    const antes = telasAntes.current
    telasAntes.current = telasPublicadas
    setFoco((atual) => decidirFoco(atual, palco, { tipo: 'palcoMudou', telasAntes: antes }))
  }, [palco, telasPublicadas, compartilhamento.trocandoTela])

  // Mostrar é automático (o app decide, não persiste); escolher é a pessoa clicando, e fica.
  function mostrarAba(aba: Aba) {
    setGaveta({ aberta: true, aba })
  }

  function escolherAba(aba: Aba) {
    mostrarAba(aba)
    gravarPreferencias({ abaDaLateral: aba })
  }

  function alternarChat() {
    // A aba que vale é a que a gaveta desenha, não a que está guardada: parar de transmitir
    // muda uma sem mexer na outra, e o botão precisa fechar o que ele diz estar aberto.
    const proximo = alternarAba({ aberta: gaveta.aberta, aba: abaDaGaveta }, 'chat')
    setGaveta(proximo)
    gravarPreferencias({ abaDaLateral: proximo.aba })
  }

  function alternarGaveta() {
    setGaveta((atual) => ({ ...atual, aberta: !atual.aberta }))
  }

  function redimensionarGaveta(largura: number) {
    setLarguraDaGaveta(largura)
    gravarPreferencias({ larguraDaLateral: largura })
  }

  // Começar a compartilhar abre a aba de qualidade: é exatamente o momento em que ela tem o
  // que dizer, e deixá-la escondida faria o ajuste virar um segredo do app.
  useEffect(() => {
    if (compartilhamento.ativo) mostrarAba('qualidade')
  }, [compartilhamento.ativo])

  // A aba que a gaveta de fato mostra. A Qualidade só existe transmitindo, e parar leva quem
  // estava nela para o Chat — derivado aqui, e não dentro da gaveta, porque o contador de não
  // lidas e o botão do chat na barra precisam enxergar a mesma aba que ela desenha.
  const abaDaGaveta: Aba = gaveta.aba === 'qualidade' && !compartilhamento.ativo ? 'chat' : gaveta.aba

  // Não lidas = o que chegou enquanto o chat não estava à mostra. Com ele à mostra, tudo é lido.
  const chatVisivel = gaveta.aberta && abaDaGaveta === 'chat'
  useEffect(() => {
    if (chatVisivel) setLidasNoChat(chat.mensagens.length)
  }, [chatVisivel, chat.mensagens.length])
  const naoLidasNoChat = chatVisivel ? 0 : Math.max(0, chat.mensagens.length - lidasNoChat)

  // O link precisa ser uma porta de verdade, especialmente para Sala privada, que não aparece
  // no saguão. A API decide se ela existe e se a senha está certa; aqui só se coleta o necessário.
  if (!credenciais) {
    return (
      <EntradaDaSala
        slug={slug}
        aoEntrar={guardar}
        aoVoltar={() => navegar('/', { replace: true })}
      />
    )
  }

  // A peça em foco pode ter acabado de sair do ar; até o efeito acima decidir de novo, o palco
  // é a grade — nunca um quadro apontando para o vazio.
  const emFoco = foco.chave === null ? null : (pecas.find((peca) => peca.chave === foco.chave) ?? null)
  const noPalco = emFoco ? [emFoco] : pecas
  const foraDoPalco = emFoco ? pecas.filter((peca) => peca.chave !== emFoco.chave) : []

  const nomeDe = (identidade: string) =>
    palco.pessoas.find((pessoa) => pessoa.identidade === identidade)?.nome ?? identidade

  function soltarOFoco() {
    setFoco((atual) => decidirFoco(atual, palco, { tipo: 'clicouNoPalco' }))
  }

  function focar(chave: string) {
    setFoco((atual) => decidirFoco(atual, palco, { tipo: 'clicouNaPeca', chave }))
  }

  function sair() {
    encerrar(slug)
    navegar('/', { replace: true })
  }

  return (
    <div className={estilos.sala}>
      <NavegacaoDaSala
        nomeDaSala={credenciais.nomeDaSala}
        nomeDaPessoa={credenciais.nome}
        conexao={conexao}
        pessoas={palco.pessoas}
        telas={palco.telas}
        aoVoltar={sair}
      />

      <section className={estilos.conteudoDaSala} aria-label={`Sala ${credenciais.nomeDaSala}`}>
        <Cabecalho
          nomeDaSala={credenciais.nomeDaSala}
          conexao={conexao}
          pessoas={palco.pessoas.length}
          gavetaAberta={gaveta.aberta}
          aoAlternarGaveta={alternarGaveta}
        />

        <div className={estilos.corpoDaSala}>
          <main className={estilos.areaDoPalco} aria-label="Palco da sala">
            <Palco
              pecas={noPalco}
              emFoco={emFoco !== null}
              aoSoltarOFoco={soltarOFoco}
              aoFocar={focar}
              volumes={volumes}
              interfaceVisivel={interfaceVisivel}
              zoom={zoom}
              aoTentarDeNovo={telemetria.rearmarRecepcao}
            />

            <div
              ref={interfaceFlutuante}
              className={estilos.interface}
              data-interface={interfaceVisivel ? 'visivel' : 'oculta'}
            >
              <div className={estilos.alto}>
                <Tira pecas={foraDoPalco} aoEscolher={focar} />
              </div>

              <div className={estilos.baixo}>
                <Controles
                  sala={sala}
                  compartilhamento={compartilhamento}
                  chatAberto={chatVisivel}
                  naoLidasNoChat={naoLidasNoChat}
                  aoAlternarChat={alternarChat}
                  aoFalhar={setErroDeDispositivo}
                  aoSair={sair}
                />
              </div>
            </div>
          </main>

          <Gaveta
            aberta={gaveta.aberta}
            aba={abaDaGaveta}
            aoTrocarAba={escolherAba}
            transmitindo={compartilhamento.ativo}
            largura={larguraDaGaveta}
            aoRedimensionar={redimensionarGaveta}
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
      </section>

      {/* Os avisos não se escondem com o resto: erro não é moldura, é alarme. */}
      <div className={estilos.avisos}>
        {erro && <Aviso tom="erro">Não foi possível conectar à sala: {erro}</Aviso>}

        {!audioLiberado && (
          <Aviso tom="neutro">
            O navegador está segurando o áudio até você interagir com a página.{' '}
            <Botao aparencia="fantasma" onClick={liberarAudio}>
              Ouvir a sala
            </Botao>
          </Aviso>
        )}

        {compartilhamento.erro && <Aviso tom="erro">{compartilhamento.erro}</Aviso>}
        {erroDeDispositivo && <Aviso tom="erro">{erroDeDispositivo}</Aviso>}
      </div>

      <AudioDaSala sala={sala} volumes={volumes} />
    </div>
  )
}
