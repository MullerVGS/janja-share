import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { decidirFoco, FOCO_INICIAL, type EstadoDoFoco } from '../../sala/foco'
import { alternarAba, type Aba, type EstadoDaLateral } from '../../sala/lateral'
import { chavesDasTelasPublicadas, montarPalco } from '../../sala/palco'
import { useAutoOcultar } from '../../sala/useAutoOcultar'
import { useFocoDeTeclado } from '../../sala/useFocoDeTeclado'
import { useChat } from '../../sala/useChat'
import { useCompartilhamento } from '../../sala/useCompartilhamento'
import { useMedia } from '../../sala/useMedia'
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
import { FaixaDeAvatares } from './FaixaDeAvatares'
import { Gaveta } from './Gaveta'
import { AudioDaSala } from './Midia'
import { NavegacaoDaSala } from './NavegacaoDaSala'
import { Palco } from './Palco'
import { Qualidade } from './Qualidade'
import { resumirTransmissao } from './resumo'
import { Transmissao } from './Transmissao'
import estilos from './Sala.module.css'

/** Abaixo disto a barra lateral vira camada por cima do palco, e não mais uma coluna. */
const LATERAL_EM_CAMADA = '(max-width: 1080px)'
/** Abaixo disto a gaveta faz o mesmo. */
const GAVETA_EM_CAMADA = '(max-width: 980px)'
/** Abaixo disto a faixa de avatares corta cedo — o palco é estreito demais para oito círculos. */
const PALCO_ESTREITO = '(max-width: 680px)'

const AVATARES_NA_FAIXA = 8
const AVATARES_NA_FAIXA_ESTREITA = 4

/** "Convite copiado" dura 1,6 s — o mesmo prazo do "Copiado" das Métricas. */
const AVISO_DE_COPIA_MS = 1600

/** A sala reúne navegação, palco e painéis sem misturar nenhum deles com o fluxo da mídia. */
export function Sala() {
  const { slug = '' } = useParams()
  const { credenciaisDe, guardar, encerrar } = useSessao()
  // A validade guardada decide só se vale abrir um `connect()` novo. Uma vez conectada, a sala
  // vive de tokens que o servidor renova sozinho (`refreshToken`) — o JWT original vencer não
  // muda nada. Reler a sessão a cada render era o que expulsava, para o formulário, quem
  // passava das 8h assistindo.
  const [entrada, setEntrada] = useState(() => ({ slug, credenciais: credenciaisDe(slug) }))
  if (entrada.slug !== slug) setEntrada({ slug, credenciais: credenciaisDe(slug) })
  const { credenciais } = entrada
  const navegar = useNavigate()
  const { sala, conexao, erro, queda, versao, audioLiberado, liberarAudio } = useSala(credenciais)
  const telemetria = useTelemetria(sala)
  const compartilhamento = useCompartilhamento(sala, telemetria.emissor, telemetria.espectadores)

  // O chat vive aqui, e não dentro de <Chat>: fechar o painel desmontava o componente, o hook
  // ia junto, o ouvinte de DataReceived era removido e a conversa inteira sumia — reabrir
  // mostrava "Nada dito ainda." enquanto os outros continuavam falando.
  const chat = useChat(sala, credenciais?.nome ?? '')
  // Um só mapa de volumes na sala: o controle está no quadro e o som sai do `AudioDaSala`.
  const volumes = useVolumes()

  const [preferencias] = useState(lerPreferencias)
  // A gaveta nasce fechada, na Conversa: nada de interface antes de alguém pedir, e cada porta
  // que a abre nomeia a sua aba — não há mais um botão genérico de painel a quem obedecer.
  const [gaveta, setGaveta] = useState<EstadoDaLateral>({ aberta: false, aba: 'chat' })
  const [larguraDaGaveta, setLarguraDaGaveta] = useState(preferencias.larguraDaLateral)
  const [lidasNoChat, setLidasNoChat] = useState(0)
  const [erroDeDispositivo, setErroDeDispositivo] = useState<string | null>(null)
  const [foco, setFoco] = useState<EstadoDoFoco>(FOCO_INICIAL)
  const [imersao, setImersao] = useState(false)
  const [conviteCopiado, setConviteCopiado] = useState(false)
  const areaDoPalco = useRef<HTMLElement>(null)

  const lateralEmCamada = useMedia(LATERAL_EM_CAMADA)
  const gavetaEmCamada = useMedia(GAVETA_EM_CAMADA)
  const palcoEstreito = useMedia(PALCO_ESTREITO)

  // Duas memórias para a mesma barra: a coluna do desktop é escolha que fica, e a camada do
  // estreito nasce sempre fechada — abri-la por preferência guardada seria cobrir o palco de
  // alguém que só girou o celular.
  const [lateralFixa, setLateralFixa] = useState(preferencias.barraLateralAberta)
  const [lateralEmCima, setLateralEmCima] = useState(false)
  const lateralAberta = (lateralEmCamada ? lateralEmCima : lateralFixa) && !imersao

  // O palco é derivado do `Room`; `versao` é o que diz que ele mudou. `telemetria.recepcao`
  // entra à parte: o cão de guarda anda no relógio da telemetria, não no dos eventos do `Room`.
  const palco = useMemo(() => montarPalco(sala, telemetria.recepcao), [sala, versao, telemetria.recepcao])
  const telasPublicadas = useMemo(() => chavesDasTelasPublicadas(sala), [sala, versao])
  // Só o que tem imagem vira quadro. Presença sem câmera é a faixa de avatares e a barra
  // lateral: um retângulo do tamanho de uma tela para mostrar duas iniciais tirava o espaço de
  // quem tem, de fato, o que mostrar.
  const quadros = useMemo(
    () => [...palco.telas, ...palco.pessoas.filter((pessoa) => pessoa.publicacao)],
    [palco],
  )
  const zoom = useZoom(quadros)
  const amostraDoEmissor = ultima(telemetria.emissor)

  // Nunca some com a gaveta aberta ou com o teclado dentro do palco: sumir é para quem largou o
  // mouse parado, não para quem está no meio de alguma coisa.
  const focoDeTeclado = useFocoDeTeclado(areaDoPalco)
  const [interfaceVisivel, ocultarAMoldura] = useAutoOcultar(gaveta.aberta || focoDeTeclado)

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

  useEffect(() => {
    if (!conviteCopiado) return
    const volta = setTimeout(() => setConviteCopiado(false), AVISO_DE_COPIA_MS)
    return () => clearTimeout(volta)
  }, [conviteCopiado])

  function mostrarAba(aba: Aba) {
    setGaveta({ aberta: true, aba })
  }

  /** O interruptor de uma aba: abre nela, e fecha se ela já está à mostra. */
  function alternarPainel(aba: Aba) {
    // A aba que vale é a que a gaveta desenha, não a que está guardada: parar de transmitir
    // muda uma sem mexer na outra, e o botão precisa fechar o que ele diz estar aberto.
    setGaveta(alternarAba({ aberta: gaveta.aberta, aba: abaDaGaveta }, aba))
  }

  function redimensionarGaveta(largura: number) {
    setLarguraDaGaveta(largura)
    gravarPreferencias({ larguraDaLateral: largura })
  }

  /**
   * Abrir a barra lateral é pedir a moldura de volta: sai da imersão junto.
   *
   * O alvo sai do que está *à vista*, não do que está guardado. Na imersão a barra continua
   * "pedida" e escondida; alternar o valor guardado ali deixaria o primeiro clique sem efeito
   * visível — sairia da imersão e fecharia a barra na mesma passada.
   */
  function alternarLateral() {
    const mostrar = !lateralAberta
    setImersao(false)
    if (lateralEmCamada) {
      setLateralEmCima(mostrar)
      return
    }
    setLateralFixa(mostrar)
    gravarPreferencias({ barraLateralAberta: mostrar })
  }

  /**
   * O clique único no palco: a moldura sai de cena e o quadro fica com a tela toda.
   *
   * Entrar apaga a moldura **na hora** — esperar os 2,6 s do relógio faria o clique parecer sem
   * efeito. Ela continua a um movimento do ponteiro de distância, e volta a sumir sozinha.
   */
  function alternarImersao() {
    const entrando = !imersao
    setImersao(entrando)
    if (entrando) ocultarAMoldura()
  }

  function fecharCamadas() {
    setLateralEmCima(false)
    if (gavetaEmCamada) setGaveta((atual) => ({ ...atual, aberta: false }))
  }

  async function copiarConvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setConviteCopiado(true)
    } catch {
      // Sem permissão ou sem a API: a URL já está na barra de endereço, ninguém fica sem saída.
    }
  }

  // Começar a compartilhar abre a aba de qualidade: é exatamente o momento em que ela tem o
  // que dizer, e deixá-la escondida faria o ajuste virar um segredo do app.
  useEffect(() => {
    if (compartilhamento.ativo) mostrarAba('qualidade')
  }, [compartilhamento.ativo])

  // A aba que a gaveta de fato mostra. A Qualidade só existe transmitindo, e parar leva quem
  // estava nela para o Chat — derivado aqui, e não dentro da gaveta, porque o contador de não
  // lidas e os botões do topo e da barra precisam enxergar a mesma aba que ela desenha.
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
        aoEntrar={(novas) => {
          guardar(novas)
          setEntrada({ slug, credenciais: novas })
        }}
        aoVoltar={() => navegar('/', { replace: true })}
      />
    )
  }

  // O destaque é a escolha da pessoa; sem escolha (ou com ela fora do ar), é o primeiro quadro
  // que existir — o palco não tem estado "nada em destaque com imagem no ar".
  const emDestaque = quadros.find((quadro) => quadro.chave === foco.chave) ?? quadros[0] ?? null
  const miniaturas = imersao ? [] : quadros.filter((quadro) => quadro.chave !== emDestaque?.chave)
  const camadaAberta = (lateralEmCamada && lateralAberta) || (gavetaEmCamada && gaveta.aberta)

  const nomeDe = (identidade: string) =>
    palco.pessoas.find((pessoa) => pessoa.identidade === identidade)?.nome ?? identidade

  function focar(chave: string) {
    setFoco((atual) => decidirFoco(atual, palco, { tipo: 'clicouNaPeca', chave }))
    if (lateralEmCamada) setLateralEmCima(false)
  }

  function sair() {
    encerrar(slug)
    navegar('/', { replace: true })
  }

  const cabecalho = (
    <Cabecalho
      nomeDaSala={credenciais.nomeDaSala}
      conexao={conexao}
      pessoas={palco.pessoas.length}
      aoAlternarLateral={alternarLateral}
      lateralAberta={lateralAberta}
      abaAMostra={gaveta.aberta ? abaDaGaveta : null}
      aoAlternarAba={alternarPainel}
      transmitindo={compartilhamento.ativo}
      naoLidasNoChat={naoLidasNoChat}
      conviteCopiado={conviteCopiado}
      aoCopiarConvite={() => void copiarConvite()}
    />
  )

  return (
    <div className={estilos.sala}>
      <NavegacaoDaSala
        nomeDaSala={credenciais.nomeDaSala}
        nomeDaPessoa={credenciais.nome}
        conexao={conexao}
        pessoas={palco.pessoas}
        telas={palco.telas}
        emDestaque={emDestaque?.chave ?? null}
        aoFocar={focar}
        aberta={lateralAberta}
        aoRecolher={alternarLateral}
        conviteCopiado={conviteCopiado}
        aoCopiarConvite={() => void copiarConvite()}
        aoSair={sair}
      />

      {/* O véu só existe quando alguma camada está aberta: é o alvo grande que fecha o que
          cobriu o palco, sem obrigar a mirar num X de 26px. */}
      {camadaAberta && <div className={estilos.veu} onClick={fecharCamadas} aria-hidden="true" />}

      <section className={estilos.conteudoDaSala} aria-label={`Sala ${credenciais.nomeDaSala}`}>
        {!imersao && cabecalho}

        <div className={estilos.corpoDaSala}>
          <main ref={areaDoPalco} className={estilos.areaDoPalco} aria-label="Palco da sala">
            {/* Na imersão o topo deixa a coluna e passa a flutuar sobre o palco, no relógio da
                moldura: some junto com os controles e volta junto com eles. Fica dentro do
                <main> de propósito — assim cobre só o palco (nunca a gaveta aberta ao lado) e o
                foco de teclado nele continua travando a moldura visível. */}
            {imersao && (
              <div
                className={estilos.topoFlutuante}
                data-interface={interfaceVisivel ? 'visivel' : 'oculta'}
              >
                {cabecalho}
              </div>
            )}

            <Palco
              emDestaque={emDestaque}
              miniaturas={miniaturas}
              aoFocar={focar}
              aoAlternarImersao={alternarImersao}
              volumes={volumes}
              interfaceVisivel={interfaceVisivel}
              zoom={zoom}
              aoTentarDeNovo={telemetria.rearmarRecepcao}
            />

            <div className={estilos.interface} data-interface={interfaceVisivel ? 'visivel' : 'oculta'}>
              <div className={estilos.alto}>
                {!imersao && (
                  <FaixaDeAvatares
                    pessoas={palco.pessoas}
                    limite={palcoEstreito ? AVATARES_NA_FAIXA_ESTREITA : AVATARES_NA_FAIXA}
                  />
                )}
              </div>

              <div className={estilos.baixo}>
                <Controles
                  sala={sala}
                  compartilhamento={compartilhamento}
                  chatAberto={chatVisivel}
                  naoLidasNoChat={naoLidasNoChat}
                  aoAlternarChat={() => alternarPainel('chat')}
                  aoAbrirQualidade={() => mostrarAba('qualidade')}
                  aoFalhar={setErroDeDispositivo}
                  aoSair={sair}
                />
              </div>
            </div>
          </main>

          <Gaveta
            aberta={gaveta.aberta}
            aba={abaDaGaveta}
            aoTrocarAba={mostrarAba}
            aoFechar={() => setGaveta((atual) => ({ ...atual, aberta: false }))}
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
            metricas={
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
        {queda && <Aviso tom="erro">Conexão perdida. Voltando para a sala… (tentativa {queda.tentativa})</Aviso>}

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
