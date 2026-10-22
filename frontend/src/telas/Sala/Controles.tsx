import { useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Room } from 'livekit-client'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import {
  IconeChat,
  IconeMicrofone,
  IconeMicrofoneMudo,
  IconeSair,
  IconeTela,
  IconeTelaNoAr,
} from '../../ui/Icone'
import { MenuDaTela } from './MenuDaTela'
import { SomSaindo } from './SomSaindo'
import estilos from './Controles.module.css'

interface Props {
  sala: Room | null
  compartilhamento: Compartilhamento
  chatAberto: boolean
  naoLidasNoChat: number
  /** Abre a gaveta no chat, ou a fecha se o chat já está à mostra. */
  aoAlternarChat(): void
  /** Abre a gaveta na aba de qualidade. */
  aoAbrirQualidade(): void
  /** Onde a falha do microfone vira faixa na tela; `null` limpa a faixa anterior. */
  aoFalhar(mensagem: string | null): void
  aoSair(): void
}

/**
 * A frase que a pessoa lê quando abrir o microfone não dá certo. `null` é o único caso de
 * desistência silenciosa: `AbortError` é a troca interrompida no meio, não uma decisão.
 *
 * Diferente do compartilhamento de tela, aqui `NotAllowedError` NÃO é silêncio: não existe
 * seletor nativo para cancelar — é a permissão negada, e ela persiste. Sem faixa, o botão
 * ficaria morto para sempre sem nunca dizer por quê, que é exatamente o defeito que isto
 * conserta. O nome do erro é a parte estável do `DOMException`; a `message` muda com o
 * navegador e com o idioma do sistema.
 */
function fraseDaFalha(falha: unknown): string | null {
  const nome = falha instanceof Error ? falha.name : ''
  if (nome === 'AbortError') return null
  if (nome === 'NotAllowedError' || nome === 'SecurityError')
    return 'O navegador bloqueou o acesso ao microfone. Libere a permissão na barra de endereço e tente de novo.'
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Não encontrei o microfone neste computador.'
  if (nome === 'NotReadableError') return 'Outro programa está usando o microfone. Feche-o e tente de novo.'
  return falha instanceof Error && falha.message ? falha.message : 'Não foi possível abrir o microfone.'
}

/**
 * Cada botão da barra traz o ícone e, embaixo, a legenda em uma palavra — o padrão das
 * ferramentas de reunião. O ícone é reconhecido de relance, e a legenda tira a dúvida de quem
 * não reconheceu sem precisar esperar a dica do `title`. O `rotulo` continua sendo o nome
 * acessível, mais completo que a legenda.
 *
 * `fechado` é o microfone mudo: fundo escuro e ícone apagado. `aceso` é a sua tela no ar —
 * contorno de acento e halo, o único botão que brilha. `ativo` é só um painel à mostra, e por
 * isso pesa menos: tinta de acento, sem contorno. `convite` é o azul-lavanda do que ainda não
 * foi feito mas é a ação principal dali. `perigo` é a saída: vermelho cheio, como o desligar de
 * uma chamada.
 */
type Tom = 'normal' | 'fechado' | 'aceso' | 'ativo' | 'convite' | 'perigo'

function Botao({
  rotulo,
  legenda,
  tom = 'normal',
  ligado,
  desabilitado = false,
  menuAberto,
  referencia,
  aoClicar,
  children,
}: {
  rotulo: string
  legenda: string
  tom?: Tom
  ligado?: boolean
  desabilitado?: boolean
  /** Presente quando o botão abre um menu: diz se ele está aberto, no lugar de `aria-pressed`. */
  menuAberto?: boolean
  referencia?: RefObject<HTMLButtonElement | null>
  aoClicar(): void
  children: ReactNode
}) {
  const abreMenu = menuAberto !== undefined
  return (
    <button
      ref={referencia}
      type="button"
      className={estilos.botao}
      data-tom={tom === 'normal' ? undefined : tom}
      aria-pressed={abreMenu ? undefined : ligado}
      aria-haspopup={abreMenu ? 'menu' : undefined}
      aria-expanded={abreMenu ? menuAberto : undefined}
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      <span className={estilos.icone}>{children}</span>
      <span className={estilos.legenda} aria-hidden="true">
        {legenda}
      </span>
    </button>
  )
}

/**
 * A barra flutuante: microfone, tela, chat e a saída. O microfone começa fechado — ninguém entra
 * numa sala já transmitindo — e o estado está no próprio botão, não escondido num menu. Não há
 * câmera: o projeto é compartilhar tela, e o SFU nem aceita publicá-la.
 *
 * No ar, o botão da tela vira "No ar" e abre o menu de quem está no ar (`MenuDaTela`): parar,
 * trocar, qualidade e som, tudo sem tirar a Tela do ar. Moram aqui, e não na pílula de um
 * quadro, porque são da SUA tela: enquanto você assiste a de outra pessoa em destaque, a sua vive
 * nas miniaturas, sem pílula nenhuma desenhada para ela. A barra é o único lugar sempre no ar.
 */
export function Controles({
  sala,
  compartilhamento,
  chatAberto,
  naoLidasNoChat,
  aoAlternarChat,
  aoAbrirQualidade,
  aoFalhar,
  aoSair,
}: Props) {
  const [mudandoMicrofone, setMudandoMicrofone] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const botaoDaTela = useRef<HTMLButtonElement>(null)

  const microfoneLigado = sala?.localParticipant.isMicrophoneEnabled ?? false
  // Sem sala não há a quem pedir microfone nem tela: botão que não faz nada tem de dizer isso.
  const semSala = sala === null
  // Quem compartilha não se ouve: o medidor é a única resposta a "está saindo som?".
  const faixaDoAudioDaTela = compartilhamento.audioDaTela?.track?.mediaStreamTrack
  const noAr = compartilhamento.ativo

  async function alternarMicrofone() {
    if (!sala) return
    aoFalhar(null)
    setMudandoMicrofone(true)
    try {
      await sala.localParticipant.setMicrophoneEnabled(!microfoneLigado)
    } catch (falha) {
      aoFalhar(fraseDaFalha(falha))
    } finally {
      setMudandoMicrofone(false)
    }
  }

  return (
    <div className={estilos.barra}>
      <Botao
        rotulo={microfoneLigado ? 'Fechar microfone' : 'Abrir microfone'}
        legenda="Microfone"
        tom={microfoneLigado ? 'normal' : 'fechado'}
        ligado={microfoneLigado}
        desabilitado={semSala || mudandoMicrofone}
        aoClicar={() => void alternarMicrofone()}
      >
        {microfoneLigado ? <IconeMicrofone tamanho={22} /> : <IconeMicrofoneMudo tamanho={22} />}
      </Botao>

      <span className={estilos.separador} aria-hidden="true" />

      {noAr ? (
        <Botao
          rotulo="Sua tela está no ar — opções"
          legenda="No ar"
          tom="aceso"
          menuAberto={menuAberto}
          referencia={botaoDaTela}
          aoClicar={() => setMenuAberto((aberto) => !aberto)}
        >
          <IconeTelaNoAr tamanho={22} />
        </Botao>
      ) : (
        <Botao
          rotulo="Compartilhar tela"
          legenda="Compartilhar"
          tom="convite"
          ligado={false}
          desabilitado={semSala || compartilhamento.ocupado}
          aoClicar={() => void compartilhamento.alternar()}
        >
          <IconeTela tamanho={22} />
        </Botao>
      )}

      {noAr && faixaDoAudioDaTela && <SomSaindo faixa={faixaDoAudioDaTela} />}

      <MenuDaTela
        ancora={botaoDaTela}
        aberto={noAr && menuAberto}
        aoFechar={() => setMenuAberto(false)}
        compartilhamento={compartilhamento}
        aoAbrirQualidade={aoAbrirQualidade}
      />

      <span className={estilos.separador} aria-hidden="true" />

      <Botao rotulo="Chat" legenda="Chat" tom={chatAberto ? 'ativo' : 'normal'} ligado={chatAberto} aoClicar={aoAlternarChat}>
        <IconeChat tamanho={22} />
        {naoLidasNoChat > 0 && (
          <span className={estilos.contador} aria-label={`${naoLidasNoChat} mensagens não lidas`}>
            {naoLidasNoChat}
          </span>
        )}
      </Botao>

      <Botao rotulo="Sair da sala" legenda="Sair" tom="perigo" aoClicar={aoSair}>
        <IconeSair tamanho={22} />
      </Botao>
    </div>
  )
}
