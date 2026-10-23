import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConnectionState } from 'livekit-client'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { trocarNaSala, type TipoDeDispositivo } from '../../sala/dispositivos'
import { estadoDaConexao, PRESO_SEM_ROTA_MS } from '../../sala/estadoDaConexao'
import { decidirFoco, FOCO_INICIAL, type EstadoDoFoco } from '../../sala/foco'
import { alternarAba, type Aba, type EstadoDaLateral } from '../../sala/lateral'
import {
  chavesDasTelasPublicadas,
  comProblemaDeConexao,
  montarPalco,
  palcoEmCena,
  pecaEncerrada,
  type Peca,
} from '../../sala/palco'
import { useAindaAi } from '../../sala/useAindaAi'
import { useAutoOcultar } from '../../sala/useAutoOcultar'
import { useCelularAssistindo } from '../../sala/useCelularAssistindo'
import { useFocoDeTeclado } from '../../sala/useFocoDeTeclado'
import { useChat } from '../../sala/useChat'
import { useCompartilhamento } from '../../sala/useCompartilhamento'
import { useDeixarDeVer } from '../../sala/useDeixarDeVer'
import { AQUECIMENTO_MS, avisoParaQuemCompartilha } from '../../sala/avisoDeQualidade'
import { useAquecido } from '../../sala/useAquecido'
import { useFalandoMudo } from '../../sala/useFalandoMudo'
import { useMedia } from '../../sala/useMedia'
import { fraseDaFalhaDoMicrofone, useMicrofone } from '../../sala/useMicrofone'
import { useSala } from '../../sala/useSala'
import { useSonsDaSala } from '../../sala/useSonsDaSala'
import { useVolumes, type ControleDeVolumes } from '../../sala/useVolumes'
import { useZoom } from '../../sala/useZoom'
import { useTituloDaAba } from '../../sala/tituloDaAba'
import { enderecoDaSala } from '../../salas/link'
import { desmascarar, mascarar } from '../../salas/mascara'
import { useLinkDaSala } from '../../salas/useLinkDaSala'
import { useSalasNoAr } from '../../salas/useSalasNoAr'
import { useSessao } from '../../sessao/sessao'
import { ultima } from '../../telemetria/historico'
import { sumiu } from '../../telemetria/relato'
import { useTelemetria } from '../../telemetria/useTelemetria'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Dialogo } from '../../ui/Dialogo'
import { Casca } from '../Casca/Casca'
import { PainelDaPessoa } from '../Casca/PainelDaPessoa'
import { PainelDeVoz } from '../Casca/PainelDeVoz'
import type { SalaAtual } from '../Casca/tipos'
import { Saguao } from '../Inicio/Saguao'
import { CabecalhoDaChamada } from './CabecalhoDaChamada'
import { Chat } from './Chat'
import { Controles } from './Controles'
import { DialogoAjustarSala } from './DialogoAjustarSala'
import { DialogoConvite } from './DialogoConvite'
import { EntradaDaSala } from './EntradaDaSala'
import { Gaveta } from './Gaveta'
import { AudioDaSala } from './Midia'
import { Palco } from './Palco'
import { Qualidade } from './Qualidade'
import { resumirTransmissao } from './resumo'
import { Transmissao } from './Transmissao'
import estilos from './Sala.module.css'

/** Abaixo disto a gaveta (o chat) vira camada por cima da chamada, e não mais uma coluna. */
const GAVETA_EM_CAMADA = '(max-width: 980px)'
/** Abaixo disto é o celular: a lista e a chamada são telas separadas. */
const CELULAR = '(max-width: 720px)'

/** "Link copiado" dura 1,6 s — o mesmo prazo do "Copiado" das Métricas. */
const AVISO_DE_COPIA_MS = 1600

/** Onde o foco do teclado não vira atalho: quem digita não está pedindo para mutar. */
function digitando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
}

/** O som da Sala para quem ensurdeceu: todo volume é zero, sem mexer no que ficou guardado. */
function surdos(volumes: ControleDeVolumes): ControleDeVolumes {
  return { ...volumes, volumeDe: () => 0 }
}

/**
 * A Sala na casca (ADR 0016): a chamada é a página, com o cabeçalho no alto, a grade (ou o
 * quadro em foco) no meio, a barra embaixo e o chat à direita; a coluna mostra a Sala acesa com
 * quem está dentro, e os painéis de voz e da pessoa ficam no rodapé. O saguão pode ser aberto por
 * cima de uma Sala conectada — a chamada segue por baixo, como em toda ferramenta de voz.
 */
export function Sala() {
  const { slug = '' } = useParams()
  const { credenciaisDe, guardar, encerrar } = useSessao()
  // A validade guardada decide só se vale abrir um `connect()` novo. Uma vez conectada, a sala
  // vive de tokens que o servidor renova sozinho (`refreshToken`) — o JWT original vencer não
  // muda nada. Reler a sessão a cada render era o que expulsava, para o formulário, quem
  // passava das 8h assistindo.
  const [entrada, setEntrada] = useState(() => ({ slug, credenciais: credenciaisDe(slug) }))
  if (entrada.slug !== slug) {
    // Mesmo token com outro slug é a mesma encarnação com nome ou visibilidade novos
    // (`useLinkDaSala`): a credencial continua a mesma, e a conexão não cai.
    const guardadas = credenciaisDe(slug)
    const mesma = guardadas !== null && guardadas.token === entrada.credenciais?.token
    setEntrada({ slug, credenciais: mesma ? entrada.credenciais : guardadas })
  }
  const { credenciais } = entrada
  const navegar = useNavigate()
  const { sala, conexao, erro, queda, versao, audioLiberado, liberarAudio } = useSala(credenciais)
  const linkDaSala = useLinkDaSala(sala, credenciais)
  const [ajustando, setAjustando] = useState(false)
  const [convidando, setConvidando] = useState(false)
  const telemetria = useTelemetria(sala)
  const compartilhamento = useCompartilhamento(sala, telemetria.emissor, telemetria.espectadores)
  const { naoVejo, deixarDeVer, verDeNovo } = useDeixarDeVer(sala, versao)
  const salasNoAr = useSalasNoAr()

  // O chat vive aqui, e não dentro de <Chat>: fechar o painel desmontava o componente, o hook
  // ia junto, o ouvinte de DataReceived era removido e a conversa inteira sumia.
  const chat = useChat(sala, credenciais?.nome ?? '')
  // Um só mapa de volumes na sala: o controle está no quadro e o som sai do `AudioDaSala`.
  const volumes = useVolumes()

  const [preferencias] = useState(lerPreferencias)
  const [meuNome, setMeuNome] = useState(preferencias.nome)
  // A gaveta nasce fechada, na Conversa: nada de interface antes de alguém pedir.
  const [gaveta, setGaveta] = useState<EstadoDaLateral>({ aberta: false, aba: 'chat' })
  const [larguraDaGaveta, setLarguraDaGaveta] = useState(preferencias.larguraDaLateral)
  const [lidasNoChat, setLidasNoChat] = useState(0)
  const [erroDeDispositivo, setErroDeDispositivo] = useState<string | null>(null)
  const [foco, setFoco] = useState<EstadoDoFoco>(FOCO_INICIAL)
  const [imersao, setImersao] = useState(false)
  const [pagina, setPagina] = useState<'chamada' | 'saguao'>('chamada')
  const [vista, setVista] = useState<'lista' | 'pagina'>('pagina')
  const [surdo, setSurdo] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const areaDoPalco = useRef<HTMLElement>(null)

  const gavetaEmCamada = useMedia(GAVETA_EM_CAMADA)
  const celular = useMedia(CELULAR)
  const conectada = conexao === ConnectionState.Connected

  const microfone = useMicrofone(sala, setErroDeDispositivo)
  const falandoMudo = useFalandoMudo(sala)

  // O palco é derivado do `Room`; `versao` é o que diz que ele mudou.
  // Antes de conectar, o próprio participante ainda não tem nome nem identidade no `Room`: o nome
  // das credenciais vale até lá, para o próprio quadro não nascer anônimo.
  const palco = useMemo(() => {
    const montado = montarPalco(sala, telemetria.recepcao, naoVejo, telemetria.redesFracas)
    const meu = credenciais?.nome ?? ''
    return {
      ...montado,
      pessoas: montado.pessoas.map((pessoa) => (pessoa.proprio && pessoa.nome === '' ? { ...pessoa, nome: meu } : pessoa)),
    }
  }, [sala, versao, telemetria.recepcao, naoVejo, telemetria.redesFracas, credenciais?.nome])
  const telasPublicadas = useMemo(() => chavesDasTelasPublicadas(sala), [sala, versao])
  // A Tela alheia que sai do ar em foco deixa o quadro dizendo que terminou, até alguém fechar,
  // olhar outro quadro ou a mesma pessoa voltar a compartilhar.
  const [visto, setVisto] = useState<Peca | null>(null)
  const [encerrada, setEncerrada] = useState<Peca | null>(null)
  const voltou = (peca: Peca) => palco.telas.some((tela) => tela.identidade === peca.identidade)
  if (encerrada && voltou(encerrada)) setEncerrada(null)
  if (!encerrada && visto && !palco.telas.some((tela) => tela.chave === visto.chave)) {
    setEncerrada(pecaEncerrada(visto))
    setVisto(null)
    setFoco({ chave: visto.chave })
  }
  const palcoDoFoco = useMemo(() => {
    const pendente = encerrada && !palco.telas.some((tela) => tela.identidade === encerrada.identidade)
    return palcoEmCena(pendente ? { ...palco, telas: [...palco.telas, encerrada] } : palco)
  }, [palco, encerrada])

  // Com Tela no ar, só as Telas; sem nenhuma, quem está na Sala (ADR 0021).
  const quadros = useMemo(() => [...palcoDoFoco.telas, ...palcoDoFoco.pessoas], [palcoDoFoco])
  const zoom = useZoom(palcoDoFoco.telas)

  // O foco é a escolha da pessoa; sem escolha (ou com ela fora do ar), é a primeira Tela — e,
  // sem Tela nenhuma, a grade. "Voltar à grade" é escolha também, e ela vale até o próximo
  // clique num quadro ou até a própria Tela entrar no ar.
  const escolhido = quadros.find((quadro) => quadro.chave === foco.chave)
  const emFoco = foco.grade ? null : (escolhido ?? palcoDoFoco.telas[0] ?? null)
  // Olhar outro quadro dispensa o cartão de quem terminou: ele é do foco, não da grade.
  if (encerrada && emFoco?.chave !== encerrada.chave) setEncerrada(null)
  const focoVivo = emFoco && emFoco.ehTela && !emFoco.encerrada && !emFoco.proprio ? emFoco : null
  useEffect(() => {
    setVisto(focoVivo)
    // A chave basta: é ela que diz que o foco vivo é outro.
  }, [focoVivo?.chave])
  // Sair da imersão é automático quando o quadro que a pedia sai de foco.
  if (imersao && !emFoco?.ehTela) setImersao(false)

  const amostraDoEmissor = ultima(telemetria.emissor)
  const quemAssiste = [...telemetria.espectadores.values()]
    .filter((espectador) => !sumiu(espectador))
    .map((espectador) => espectador.nome)
  const minhaQualidade = sala?.localParticipant.connectionQuality
  const noArAquecido = useAquecido(compartilhamento.ativo ? 'no-ar' : null, AQUECIMENTO_MS)
  const avisoDaMinhaTela = compartilhamento.ativo
    ? avisoParaQuemCompartilha({ minha: minhaQualidade, assistindo: quemAssiste.length, aquecido: noArAquecido })
    : null

  // Nunca some com a gaveta aberta ou com o teclado dentro da chamada.
  const focoDeTeclado = useFocoDeTeclado(areaDoPalco)
  // No celular a barra fica (como no app de bolso), menos na imersão.
  // O aviso de silenciado traz a barra de volta: ele mora junto do microfone.
  const [interfaceVisivel, ocultarAMoldura] = useAutoOcultar(
    gaveta.aberta || focoDeTeclado || (celular && !imersao) || falandoMudo !== null,
  )

  const telasAntes = useRef<string[]>([])
  useEffect(() => {
    const antes = telasAntes.current
    telasAntes.current = telasPublicadas
    setFoco((atual) => decidirFoco(atual, palcoDoFoco, { tipo: 'palcoMudou', telasAntes: antes }))
  }, [palcoDoFoco, telasPublicadas])

  useEffect(() => {
    if (!linkCopiado) return
    const volta = setTimeout(() => setLinkCopiado(false), AVISO_DE_COPIA_MS)
    return () => clearTimeout(volta)
  }, [linkCopiado])

  // Preso sem conectar por 10 s, o rótulo vira "Sem rota" com o que fazer (ticket 03).
  const [semRota, setSemRota] = useState(false)
  useEffect(() => {
    if (conectada || !credenciais) {
      setSemRota(false)
      return
    }
    const preso = setTimeout(() => setSemRota(true), PRESO_SEM_ROTA_MS)
    return () => clearTimeout(preso)
  }, [conectada, credenciais])
  const estadoDaVoz = estadoDaConexao(conexao, minhaQualidade, semRota ? PRESO_SEM_ROTA_MS : 0)

  function mostrarAba(aba: Aba) {
    setGaveta({ aberta: true, aba })
  }

  function mostrarChamada() {
    setPagina('chamada')
    setVista('pagina')
  }

  /** O interruptor de uma aba: abre nela, e fecha se ela já está à mostra. */
  function alternarPainel(aba: Aba) {
    setGaveta(alternarAba({ aberta: gaveta.aberta, aba: abaDaGaveta }, aba))
  }

  function redimensionarGaveta(largura: number) {
    setLarguraDaGaveta(largura)
    gravarPreferencias({ larguraDaLateral: largura })
  }

  /**
   * O clique único na Tela em foco: a casca sai de cena e a chamada fica com a janela toda.
   * Entrar apaga a moldura **na hora** — esperar o relógio faria o clique parecer sem efeito.
   */
  function alternarImersao() {
    const entrando = !imersao
    setImersao(entrando)
    if (entrando) ocultarAMoldura()
  }

  const linkCompleto = `${window.location.origin}${enderecoDaSala(
    linkDaSala.link?.slug ?? slug,
    linkDaSala.link?.assinatura ?? credenciais?.assinatura,
  )}`

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkCompleto)
      setLinkCopiado(true)
    } catch {
      // Sem permissão ou sem a API: o Convidar mostra o link para copiar à mão.
    }
  }

  const sair = useCallback(() => {
    encerrar(slug)
    navegar('/', { replace: true })
  }, [encerrar, slug, navegar])

  // A Tela que volta sozinha depois de uma queda (ADR 0014) não é começar a compartilhar: a
  // gaveta não se reabre por cima da chamada de quem a tinha fechado.
  const telaGuardada = useRef(false)
  useEffect(() => {
    if (queda?.comTela) telaGuardada.current = true
    else if (!queda && !compartilhamento.ativo) telaGuardada.current = false
  }, [queda, compartilhamento.ativo])

  // Começar a compartilhar abre a aba de qualidade: é exatamente o momento em que ela tem o
  // que dizer. No celular a gaveta cobriria a chamada inteira, e lá ela espera ser pedida.
  useEffect(() => {
    if (!compartilhamento.ativo) return
    if (telaGuardada.current) {
      telaGuardada.current = false
      return
    }
    if (!celular) mostrarAba('qualidade')
  }, [compartilhamento.ativo])

  // A aba que a gaveta de fato mostra. A Qualidade só existe transmitindo.
  const abaDaGaveta: Aba = gaveta.aba === 'qualidade' && !compartilhamento.ativo ? 'chat' : gaveta.aba

  // Não lidas = o que chegou enquanto o chat não estava à mostra.
  const chatVisivel = gaveta.aberta && abaDaGaveta === 'chat' && pagina === 'chamada'
  useEffect(() => {
    if (chatVisivel) setLidasNoChat(chat.mensagens.length)
  }, [chatVisivel, chat.mensagens.length])
  const naoLidasNoChat = chatVisivel ? 0 : Math.max(0, chat.mensagens.length - lidasNoChat)

  const nomeDaSala = linkDaSala.link?.nomeDaSala ?? credenciais?.nomeDaSala ?? ''
  const fixa = linkDaSala.link?.fixa ?? false
  const privada = linkDaSala.link?.privada ?? credenciais?.privada === true

  // — polimento (ticket 04) —
  useTituloDaAba({ nomeDaSala: credenciais ? nomeDaSala : null, aoVivo: compartilhamento.ativo, naoLidas: naoLidasNoChat })
  useSonsDaSala(palco, conectada)
  const sozinho = conectada && palco.pessoas.length === 1
  const aindaAi = useAindaAi(sozinho && !compartilhamento.ativo, sair)

  // A Sala privada não mostra o endereço na barra enquanto a minha Tela está no ar.
  const enderecoVerdadeiro = enderecoDaSala(linkDaSala.link?.slug ?? slug, linkDaSala.link?.assinatura)
  const mascarada = privada && compartilhamento.ativo
  useEffect(() => {
    if (!mascarada) return
    mascarar(linkDaSala.link?.slug ?? slug, enderecoVerdadeiro)
    return () => desmascarar()
  }, [mascarada, enderecoVerdadeiro])

  // M abre e fecha o microfone, com a aba em foco e fora de campo de texto.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key.toLowerCase() !== 'm' || evento.ctrlKey || evento.metaKey || evento.altKey) return
      if (digitando(evento.target) || !sala) return
      evento.preventDefault()
      void microfone.alternar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [sala, microfone.alternar])

  // — celular como espectador (ticket 03) —
  const assistindoAlheia = pagina === 'chamada' && palco.telas.some((tela) => !tela.proprio)
  const avisoDeVolta = useCelularAssistindo({
    assistindo: assistindoAlheia,
    conectada,
    aoVoltar: telemetria.recarregarMidia,
  })

  function alternarSurdo() {
    const ensurdecer = !surdo
    setSurdo(ensurdecer)
    if (ensurdecer && microfone.ligado) void microfone.alternar(false)
  }

  function trocarDispositivo(tipo: TipoDeDispositivo, id: string) {
    if (!sala) return
    setErroDeDispositivo(null)
    trocarNaSala(sala, tipo, id).catch((falha: unknown) => {
      setErroDeDispositivo(
        tipo === 'microfone'
          ? fraseDaFalhaDoMicrofone(falha)
          : 'Não foi possível tocar a sala nesse aparelho. O som segue no anterior.',
      )
    })
  }

  function definirNome(nome: string) {
    setMeuNome(nome)
    gravarPreferencias({ nome })
  }

  const salaAtual: SalaAtual | null = credenciais
    ? {
        slug: linkDaSala.link?.slug ?? slug,
        nome: nomeDaSala,
        privada,
        fixa,
        assinatura: linkDaSala.link?.assinatura ?? null,
        aMostra: pagina === 'chamada',
        pessoas: palco.pessoas.map((pessoa) => ({
          chave: pessoa.chave,
          nome: pessoa.nome,
          aoVivo: palco.telas.some((tela) => tela.identidade === pessoa.identidade),
          microfoneAberto: pessoa.microfoneLigado,
          falando: pessoa.falando,
          proprio: pessoa.proprio,
          comProblema: comProblemaDeConexao(pessoa),
        })),
      }
    : null

  // O link precisa ser uma porta de verdade, especialmente para Sala privada, que não aparece
  // no saguão. A API decide se ela existe; aqui só se coleta o nome de quem está chegando.
  if (!credenciais) {
    return (
      <>
        <Casca
          salaAtual={null}
          noSaguao
          aoIrAoSaguao={() => navegar('/', { replace: true })}
          vistaNoCelular="lista"
          paineis={
            <PainelDaPessoa nome={meuNome} aoMudarNome={definirNome} estado="Entrando…" microfone={null} surdo={null} />
          }
          pagina={({ criarSala }) => <Saguao noAr={salasNoAr.data} aoCriar={criarSala} />}
        />
        <EntradaDaSala
          slug={slug}
          aoEntrar={(novas) => {
            guardar(novas)
            setEntrada({ slug, credenciais: novas })
          }}
          aoVoltar={() => navegar('/', { replace: true })}
        />
      </>
    )
  }

  const camadaAberta = gavetaEmCamada && gaveta.aberta && pagina === 'chamada'
  const nomeDe = (identidade: string) =>
    palco.pessoas.find((pessoa) => pessoa.identidade === identidade)?.nome ?? identidade

  function focar(chave: string) {
    setFoco((atual) => decidirFoco(atual, palcoDoFoco, { tipo: 'clicouNaPeca', chave }))
  }

  const avisos = (
    <div className={estilos.avisos}>
      {erro && <Aviso tom="erro">Não foi possível conectar à sala: {erro}</Aviso>}
      {linkDaSala.aviso && <Aviso tom="neutro">{linkDaSala.aviso}</Aviso>}
      {queda && (
        <Aviso tom="erro">
          Conexão perdida. Voltando para a sala… (tentativa {queda.tentativa})
          {queda.comTela && ' · sua tela volta ao ar sozinha'}
        </Aviso>
      )}
      {avisoDeVolta && <Aviso tom="neutro">{avisoDeVolta}</Aviso>}
      {!audioLiberado && (
        <Aviso tom="neutro">
          O navegador está segurando o áudio até você interagir com a página.{' '}
          <Botao aparencia="fantasma" onClick={liberarAudio}>
            Ouvir a sala
          </Botao>
        </Aviso>
      )}
      {compartilhamento.erro && <Aviso tom="erro">{compartilhamento.erro}</Aviso>}
      {avisoDaMinhaTela && <Aviso tom="neutro">{avisoDaMinhaTela}</Aviso>}
      {compartilhamento.fimDaFonte === 'tela' && (
        <Aviso tom="neutro">
          Sua tela saiu do ar: a janela foi fechada ou o navegador parou o compartilhamento.{' '}
          <Botao aparencia="fantasma" onClick={() => void compartilhamento.alternar()}>
            Compartilhar de novo
          </Botao>
          <Botao aparencia="fantasma" onClick={compartilhamento.dispensarFimDaFonte}>
            Fechar
          </Botao>
        </Aviso>
      )}
      {compartilhamento.fimDaFonte === 'som' && (
        <Aviso tom="neutro">
          O som da sua tela parou; a imagem continua no ar.{' '}
          <Botao aparencia="fantasma" onClick={() => void compartilhamento.trocarDeTela()}>
            Escolher a tela de novo
          </Botao>
          <Botao aparencia="fantasma" onClick={compartilhamento.dispensarFimDaFonte}>
            Fechar
          </Botao>
        </Aviso>
      )}
      {erroDeDispositivo && <Aviso tom="erro">{erroDeDispositivo}</Aviso>}
    </div>
  )

  const chamada = (
    <div className={estilos.chamada}>
      <section className={estilos.areaDaChamada} aria-label={`Sala ${nomeDaSala}`}>
        <main ref={areaDoPalco} className={estilos.areaDoPalco} aria-label="Palco da sala">
          <Palco
            quadros={quadros}
            emFoco={emFoco}
            aoFocar={focar}
            aoAlternarImersao={alternarImersao}
            volumes={volumes}
            interfaceVisivel={interfaceVisivel}
            imersao={imersao}
            zoom={zoom}
            aoTentarDeNovo={telemetria.rearmarRecepcao}
            minhaConexao={conexao}
            minhaQualidade={minhaQualidade}
            aoFecharEncerrada={() => setEncerrada(null)}
            aoDeixarDeVer={deixarDeVer}
            aoVerDeNovo={verDeNovo}
          />

          {sozinho && !emFoco && (
            <div className={estilos.sozinho} role="status">
              <strong>Você está sozinho(a) aqui</strong>
              <span>Chame a turma: o link traz quem você quiser para esta sala.</span>
              <Botao aparencia="primario" onClick={() => void copiarLink()}>
                {linkCopiado ? 'Link copiado' : 'Copiar link'}
              </Botao>
            </div>
          )}

          <div className={estilos.interface} data-interface={interfaceVisivel ? 'visivel' : 'oculta'}>
            <div className={estilos.alto}>
              <CabecalhoDaChamada
                nomeDaSala={nomeDaSala}
                fixa={fixa}
                aoVoltarALista={() => setVista('lista')}
                aoConvidar={() => setConvidando(true)}
                chatAberto={chatVisivel}
                naoLidasNoChat={naoLidasNoChat}
                aoAlternarChat={() => alternarPainel('chat')}
              />
            </div>

            <div className={estilos.baixo}>
              <Controles
                sala={sala}
                compartilhamento={compartilhamento}
                quemAssiste={quemAssiste}
                aoVoltarAGrade={
                  emFoco ? () => setFoco((atual) => decidirFoco(atual, palcoDoFoco, { tipo: 'voltouAGrade' })) : undefined
                }
                avisoDoMicrofone={falandoMudo}
                aoAbrirQualidade={() => mostrarAba('qualidade')}
                aoFalhar={setErroDeDispositivo}
                aoSair={sair}
              />
            </div>
          </div>
        </main>
      </section>

      {camadaAberta && (
        <div
          className={estilos.veu}
          onClick={() => setGaveta((atual) => ({ ...atual, aberta: false }))}
          aria-hidden="true"
        />
      )}

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
        chat={<Chat chat={chat} nomeDaSala={nomeDaSala} />}
      />
    </div>
  )

  return (
    <>
      <Casca
        salaAtual={salaAtual}
        noSaguao={pagina === 'saguao'}
        aoIrAoSaguao={() => {
          setPagina('saguao')
          if (!celular) setVista('pagina')
        }}
        aoMostrarSalaAtual={mostrarChamada}
        aoAjustarSala={linkDaSala.link ? () => setAjustando(true) : undefined}
        vistaNoCelular={vista}
        imersao={imersao}
        paineis={
          <>
            <PainelDeVoz
              estado={estadoDaVoz}
              nomeDaSala={nomeDaSala}
              aoMostrarSala={mostrarChamada}
              aoSair={sair}
              compartilhando={compartilhamento.ativo}
              aoAlternarTela={() => (compartilhamento.ativo ? mostrarChamada() : void compartilhamento.alternar())}
              telaOcupada={compartilhamento.ocupado}
              aoRecarregarMidia={telemetria.recarregarMidia}
              aoConvidar={() => setConvidando(true)}
              aoVerMetricas={() => {
                mostrarChamada()
                mostrarAba('metricas')
              }}
              conectada={conectada}
            />
            <PainelDaPessoa
              nome={meuNome}
              aoMudarNome={definirNome}
              estado={conectada ? 'Na sala' : 'Conectando…'}
              microfone={{
                ligado: microfone.ligado,
                ocupado: microfone.ocupado,
                alternar: () => void microfone.alternar(),
                aviso: pagina === 'saguao' || celular ? falandoMudo : null,
              }}
              surdo={{ ligado: surdo, alternar: alternarSurdo }}
              aoTrocarDispositivo={trocarDispositivo}
            />
          </>
        }
        pagina={({ criarSala }) => (
          <>
            {pagina === 'saguao' ? <Saguao noAr={salasNoAr.data} aoCriar={criarSala} /> : chamada}
            {avisos}
          </>
        )}
      />

      <AudioDaSala sala={sala} volumes={surdo ? surdos(volumes) : volumes} />

      {linkDaSala.link && (
        <DialogoAjustarSala
          aberto={ajustando}
          link={linkDaSala.link}
          token={credenciais.token}
          aoAjustar={(novo) => {
            linkDaSala.aplicar(novo)
            setAjustando(false)
          }}
          aoFechar={() => setAjustando(false)}
        />
      )}

      <DialogoConvite
        aberto={convidando}
        nomeDaSala={nomeDaSala}
        fixa={fixa}
        link={linkCompleto}
        oculto={mascarada}
        aoFechar={() => setConvidando(false)}
      />

      <Dialogo aberto={aindaAi.perguntando} titulo="Ainda está aí?" aoFechar={aindaAi.responder}>
        <p className={estilos.textoDoDialogo}>
          Você está sozinho(a) nesta sala há meia hora. Se ninguém responder em 2 minutos, você sai e a sala fica
          guardada para a turma voltar pelo link.
        </p>
        <div className={estilos.acoesDoDialogo}>
          <Botao aparencia="secundario" onClick={sair}>
            Sair da sala
          </Botao>
          <Botao aparencia="primario" onClick={aindaAi.responder}>
            Estou aqui
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}
