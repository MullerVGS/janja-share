import {
  ArrowsLeftRight,
  Broadcast,
  CaretDown,
  ChartLine,
  ChatCircle,
  Check,
  Copy,
  CornersIn,
  CornersOut,
  DiceFive,
  Gear,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Microphone,
  MicrophoneSlash,
  MonitorArrowUp,
  MonitorPlay,
  PaperPlaneRight,
  PhoneDisconnect,
  PictureInPicture,
  Plus,
  SidebarSimple,
  SpeakerHigh,
  SpeakerSlash,
  StopCircle,
  UserPlus,
  Users,
  Waveform,
  X,
  type Icon,
} from '@phosphor-icons/react'

interface Props {
  tamanho?: number
}

/**
 * Os ícones do produto, do Phosphor (peso regular), com o vocabulário do domínio por cima.
 *
 * A camada existe por dois motivos: o nome do ícone fica em PT-BR como o resto do código, e a
 * troca de biblioteca (ou de peso) acontece aqui, não nas trinta chamadas espalhadas. Todos
 * herdam `currentColor` — a cor vem sempre do estado de quem os hospeda.
 *
 * A regra da escolha é o glifo que Meet, Zoom, Teams e players de vídeo já ensinaram: quem bate
 * o olho reconhece sem ler a dica. Uma ação, um ícone — o mesmo desenho não serve a duas coisas,
 * e a mesma coisa não ganha dois desenhos em lugares diferentes.
 */
function envolver(Fonte: Icon, padrao = 20) {
  return function Envolvido({ tamanho = padrao }: Props) {
    return <Fonte size={tamanho} aria-hidden="true" />
  }
}

export const IconeMicrofone = envolver(Microphone)
export const IconeMicrofoneMudo = envolver(MicrophoneSlash)
export const IconeTela = envolver(MonitorArrowUp, 24)
export const IconePararTela = envolver(StopCircle, 24)
export const IconeTrocarTela = envolver(ArrowsLeftRight)
export const IconeTelaNoAr = envolver(MonitorPlay, 16)
export const IconeFalando = envolver(Waveform)
/** Sair da sala é desligar a chamada, como em toda ferramenta de reunião. */
export const IconeSair = envolver(PhoneDisconnect)
export const IconeChat = envolver(ChatCircle)
export const IconeSom = envolver(SpeakerHigh)
export const IconeSomMudo = envolver(SpeakerSlash)
export const IconeTelaCheia = envolver(CornersOut)
export const IconeSairDaTelaCheia = envolver(CornersIn)
export const IconeJanelinha = envolver(PictureInPicture)
/** Caber e 1:1 são zoom: a lupa não se confunde com a tela cheia, que é o par de cantos. */
export const IconePixelAPixel = envolver(MagnifyingGlassPlus)
export const IconeCaber = envolver(MagnifyingGlassMinus)
export const IconePainel = envolver(SidebarSimple)
export const IconeMetricas = envolver(ChartLine)
export const IconeQualidade = envolver(Gear)
export const IconeConvite = envolver(UserPlus)
export const IconeCopiar = envolver(Copy)
export const IconeCerto = envolver(Check)
export const IconeMais = envolver(Plus)
export const IconeDado = envolver(DiceFive)
export const IconePessoas = envolver(Users)
export const IconeMarca = envolver(Broadcast)
export const IconeEnviar = envolver(PaperPlaneRight)
export const IconeFechar = envolver(X)
export const IconeSetaBaixo = envolver(CaretDown)
