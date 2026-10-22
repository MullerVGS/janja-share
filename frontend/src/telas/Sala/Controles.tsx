import { useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Room } from 'livekit-client'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import { useMicrofone } from '../../sala/useMicrofone'
import {
  IconeAssistindo,
  IconeGrade,
  IconeMicrofone,
  IconeMicrofoneMudo,
  IconeSair,
  IconeTela,
  IconeTelaNoAr,
} from '../../ui/Icone'
import { Suspenso } from '../../ui/Suspenso'
import { MenuDaTela } from './MenuDaTela'
import { SomSaindo } from './SomSaindo'
import estilos from './Controles.module.css'

interface Props {
  sala: Room | null
  compartilhamento: Compartilhamento
  /** Os nomes de quem está assistindo a minha Tela agora, pelos relatos da telemetria. */
  quemAssiste: string[]
  /** Com um quadro em foco, o botão que devolve a chamada à grade. */
  aoVoltarAGrade?(): void
  /** O balão de "Você está silenciado(a)", ao lado do microfone. */
  avisoDoMicrofone?: string | null
  /** Abre a gaveta na aba de qualidade. */
  aoAbrirQualidade(): void
  /** Onde a falha do microfone vira faixa na tela; `null` limpa a faixa anterior. */
  aoFalhar(mensagem: string | null): void
  aoSair(): void
}

/**
 * Os botões da barra são só ícone, de 48 px com canto de 12 px — o nome fica no `title` e no
 * nome acessível.
 *
 * `fechado` é o microfone mudo: tinta vermelha com o ícone vermelho. `aceso` é a sua tela no ar:
 * o botão claro, o único que acende. `perigo` é a saída: vermelho cheio, como o desligar de uma
 * chamada.
 */
type Tom = 'normal' | 'fechado' | 'aceso' | 'perigo'

function Botao({
  rotulo,
  tom = 'normal',
  ligado,
  desabilitado = false,
  expandido,
  abreMenu = false,
  referencia,
  aoClicar,
  children,
}: {
  rotulo: string
  tom?: Tom
  ligado?: boolean
  desabilitado?: boolean
  /** Presente quando o botão abre um suspenso: diz se ele está aberto, no lugar de `aria-pressed`. */
  expandido?: boolean
  /** O suspenso é um menu de ações (e não uma lista para ler). */
  abreMenu?: boolean
  referencia?: RefObject<HTMLButtonElement | null>
  aoClicar(): void
  children: ReactNode
}) {
  const abreSuspenso = expandido !== undefined
  return (
    <button
      ref={referencia}
      type="button"
      className={estilos.botao}
      data-tom={tom === 'normal' ? undefined : tom}
      aria-pressed={abreSuspenso ? undefined : ligado}
      aria-haspopup={abreMenu ? 'menu' : undefined}
      aria-expanded={expandido}
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      <span className={estilos.icone}>{children}</span>
    </button>
  )
}

/**
 * A barra da chamada, centrada embaixo: microfone, tela, quem assiste e a saída — e, com um
 * quadro em foco, a volta à grade. O microfone começa fechado — ninguém entra
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
  quemAssiste,
  aoVoltarAGrade,
  avisoDoMicrofone = null,
  aoAbrirQualidade,
  aoFalhar,
  aoSair,
}: Props) {
  const microfone = useMicrofone(sala, aoFalhar)
  const [menuAberto, setMenuAberto] = useState(false)
  const botaoDaTela = useRef<HTMLButtonElement>(null)
  const [listaAberta, setListaAberta] = useState(false)
  const botaoDeQuemAssiste = useRef<HTMLButtonElement>(null)

  const microfoneLigado = microfone.ligado
  // Sem sala não há a quem pedir microfone nem tela: botão que não faz nada tem de dizer isso.
  const semSala = sala === null
  // Quem compartilha não se ouve: o medidor é a única resposta a "está saindo som?".
  const faixaDoAudioDaTela = compartilhamento.audioDaTela?.track?.mediaStreamTrack
  const noAr = compartilhamento.ativo
  const assistindo = quemAssiste.length
  const fraseDeQuemAssiste =
    assistindo === 0 ? 'Ninguém assistindo ainda' : `${assistindo} assistindo: ${quemAssiste.join(', ')}`

  return (
    <div className={estilos.barra}>
      <span className={estilos.ancoraDoAviso}>
        <Botao
          rotulo={microfoneLigado ? 'Fechar microfone' : 'Abrir microfone'}
          tom={microfoneLigado ? 'normal' : 'fechado'}
          ligado={microfoneLigado}
          desabilitado={semSala || microfone.ocupado}
          aoClicar={() => void microfone.alternar()}
        >
          {microfoneLigado ? <IconeMicrofone tamanho={24} /> : <IconeMicrofoneMudo tamanho={24} />}
        </Botao>
        {avisoDoMicrofone && (
          <span className={estilos.aviso} role="status">
            {avisoDoMicrofone}
          </span>
        )}
      </span>

      {noAr ? (
        <Botao
          rotulo="Sua tela está no ar — opções"
          tom="aceso"
          expandido={menuAberto}
          abreMenu
          referencia={botaoDaTela}
          aoClicar={() => setMenuAberto((aberto) => !aberto)}
        >
          <IconeTelaNoAr tamanho={24} />
        </Botao>
      ) : (
        <Botao
          rotulo="Compartilhar tela"
          ligado={false}
          desabilitado={semSala || compartilhamento.ocupado}
          aoClicar={() => void compartilhamento.alternar()}
        >
          <IconeTela tamanho={24} />
        </Botao>
      )}

      {noAr && faixaDoAudioDaTela && <SomSaindo faixa={faixaDoAudioDaTela} />}

      {/* Quem compartilha quer saber se alguém está vendo: o número na barra, os nomes no
          passar do mouse e no toque (no celular não há hover). */}
      {noAr && (
        <Botao
          rotulo={fraseDeQuemAssiste}
          expandido={listaAberta}
          referencia={botaoDeQuemAssiste}
          aoClicar={() => setListaAberta((aberta) => !aberta)}
        >
          <IconeAssistindo tamanho={24} />
          {assistindo > 0 && (
            <span className={estilos.contador} aria-hidden="true">
              {assistindo}
            </span>
          )}
        </Botao>
      )}

      <Suspenso
        ancora={botaoDeQuemAssiste}
        aberto={noAr && listaAberta}
        aoFechar={() => setListaAberta(false)}
        rotulo="Quem está assistindo"
        papel="group"
      >
        {assistindo === 0 ? (
          <p className={estilos.ninguem}>Ninguém assistindo ainda.</p>
        ) : (
          <ul className={estilos.quemAssiste}>
            {quemAssiste.map((nome) => (
              <li key={nome}>{nome}</li>
            ))}
          </ul>
        )}
      </Suspenso>

      <MenuDaTela
        ancora={botaoDaTela}
        aberto={noAr && menuAberto}
        aoFechar={() => setMenuAberto(false)}
        compartilhamento={compartilhamento}
        aoAbrirQualidade={aoAbrirQualidade}
      />

      {aoVoltarAGrade && (
        <Botao rotulo="Voltar à grade" aoClicar={aoVoltarAGrade}>
          <IconeGrade tamanho={24} />
        </Botao>
      )}

      <Botao rotulo="Sair da sala" tom="perigo" aoClicar={aoSair}>
        <IconeSair tamanho={24} />
      </Botao>
    </div>
  )
}
