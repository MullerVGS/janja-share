import {
  ArrowsLeftRight,
  ArrowsOut,
  ArrowsIn,
  Broadcast,
  CaretDown,
  ChatCircle,
  Check,
  CornersOut,
  DiceFive,
  FrameCorners,
  Gear,
  Link as LinkPhosphor,
  Lock,
  Microphone,
  MicrophoneSlash,
  Monitor,
  MonitorArrowUp,
  MonitorPlay,
  PaperPlaneRight,
  PictureInPicture,
  Plus,
  Pulse,
  SidebarSimple,
  SignOut,
  SpeakerHigh,
  SpeakerSlash,
  Users,
  VideoCamera,
  VideoCameraSlash,
  Waveform,
  X,
  type Icon,
} from '@phosphor-icons/react'
import estilos from './Icone.module.css'

interface Props {
  tamanho?: number
}

/**
 * Os ícones do produto, do Phosphor (peso regular), com o vocabulário do domínio por cima.
 *
 * A camada existe por dois motivos: o nome do ícone fica em PT-BR como o resto do código, e a
 * troca de biblioteca (ou de peso) acontece aqui, não nas trinta chamadas espalhadas. Todos
 * herdam `currentColor` — a cor vem sempre do estado de quem os hospeda.
 */
function envolver(Fonte: Icon, padrao = 20) {
  return function Envolvido({ tamanho = padrao }: Props) {
    return <Fonte size={tamanho} aria-hidden="true" />
  }
}

export const IconeMicrofone = envolver(Microphone)
export const IconeMicrofoneMudo = envolver(MicrophoneSlash)
export const IconeCamera = envolver(VideoCamera)
export const IconeCameraFechada = envolver(VideoCameraSlash)
export const IconeTela = envolver(MonitorArrowUp, 24)
export const IconeTelaNoAr = envolver(MonitorPlay, 16)
export const IconeFalando = envolver(Waveform)
export const IconeSair = envolver(SignOut)
export const IconeChat = envolver(ChatCircle)
export const IconeSom = envolver(SpeakerHigh)
export const IconeSomMudo = envolver(SpeakerSlash)
export const IconeTelaCheia = envolver(CornersOut)
export const IconeSairDaTelaCheia = envolver(ArrowsIn)
export const IconeJanelinha = envolver(PictureInPicture)
export const IconePixelAPixel = envolver(ArrowsOut)
export const IconeCaber = envolver(FrameCorners)
export const IconePainel = envolver(SidebarSimple)
export const IconeMetricas = envolver(Pulse)
export const IconeConvite = envolver(LinkPhosphor)
export const IconeCopiar = envolver(LinkPhosphor)
export const IconeCerto = envolver(Check)
export const IconeCadeado = envolver(Lock)
export const IconeMais = envolver(Plus)
export const IconeDado = envolver(DiceFive)
export const IconePessoas = envolver(Users)
export const IconeMarca = envolver(Broadcast)
export const IconeEnviar = envolver(PaperPlaneRight)
export const IconeFechar = envolver(X)
export const IconeSetaBaixo = envolver(CaretDown)

/**
 * A composição "dentro da TV": um monitor com um símbolo pequeno na área da tela.
 *
 * Os três controles da própria transmissão — trocar de fonte, o som dela, os ajustes — falam de
 * *uma tela* e não da ação genérica. Um par de ícones lado a lado diria isso em duas peças; pôr
 * o símbolo dentro do monitor diz em uma, e é o que distingue "trocar de tela" de "trocar" na
 * barra. O deslocamento de 2px para cima centra o símbolo na parte de imagem do monitor, que
 * não é o centro geométrico do glifo — abaixo dela ainda vem o pé.
 */
function NaTv({ Dentro, tamanho = 24 }: { Dentro: Icon; tamanho?: number }) {
  return (
    <span className={estilos.naTv} style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <Monitor size={tamanho} className={estilos.moldura} />
      <Dentro size={Math.round(tamanho * 0.46)} className={estilos.dentro} />
    </span>
  )
}

export function IconeTrocarTela(props: Props) {
  return <NaTv Dentro={ArrowsLeftRight} {...props} />
}

export function IconeAudioDaTela(props: Props) {
  return <NaTv Dentro={SpeakerHigh} {...props} />
}

export function IconeAudioDaTelaMudo(props: Props) {
  return <NaTv Dentro={SpeakerSlash} {...props} />
}

export function IconeAjustesDaTela(props: Props) {
  return <NaTv Dentro={Gear} {...props} />
}
