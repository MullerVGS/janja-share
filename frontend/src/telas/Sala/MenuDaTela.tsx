import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import { IconePararTela, IconeQualidade, IconeSom, IconeSomMudo, IconeTrocarTela } from '../../ui/Icone'
import { Suspenso } from '../../ui/Suspenso'
import estilos from './MenuDaTela.module.css'

interface Props {
  ancora: RefObject<HTMLElement | null>
  aberto: boolean
  aoFechar(): void
  compartilhamento: Compartilhamento
  aoAbrirQualidade(): void
}

function Item({
  icone,
  tom,
  marcado,
  desabilitado,
  dica,
  aoEscolher,
  children,
}: {
  icone: ReactNode
  tom?: 'perigo'
  /** Presente só no item que liga e desliga: vira `menuitemcheckbox`. */
  marcado?: boolean
  desabilitado?: boolean
  dica?: string
  aoEscolher(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role={marcado === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={marcado}
      className={estilos.item}
      data-tom={tom}
      disabled={desabilitado}
      title={dica}
      onClick={aoEscolher}
    >
      <span className={estilos.icone} aria-hidden="true">
        {icone}
      </span>
      {children}
    </button>
  )
}

/**
 * O menu de quem está no ar: tudo o que se muda numa Tela sem tirá-la do ar, e o parar.
 *
 * Parar vem primeiro e na cor de perigo — é o que se procura com pressa, e o vermelho diz que
 * aquele é o único item que derruba alguma coisa. Os outros três valem com a Tela no ar: trocar
 * a fonte (mesma publicação), abrir a Qualidade e ligar ou calar o som. O som não fecha o menu,
 * porque é um interruptor e quem mexe nele quer ver o estado mudar.
 */
export function MenuDaTela({ ancora, aberto, aoFechar, compartilhamento, aoAbrirQualidade }: Props) {
  const lista = useRef<HTMLDivElement>(null)
  const { audioDaTela } = compartilhamento
  const somNoAr = Boolean(audioDaTela && !audioDaTela.isMuted)

  // O foco entra no primeiro item ao abrir: quem abriu pelo teclado segue pelo teclado.
  useEffect(() => {
    if (aberto) lista.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
  }, [aberto])

  function andar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    const itens = [...(lista.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])]
    const atual = itens.indexOf(document.activeElement as HTMLElement)
    const passo = evento.key === 'ArrowDown' ? 1 : -1
    itens[(atual + passo + itens.length) % itens.length]?.focus()
  }

  const escolher = (acao: () => void) => () => {
    aoFechar()
    acao()
  }

  return (
    <Suspenso ancora={ancora} aberto={aberto} aoFechar={aoFechar} rotulo="Sua tela no ar" papel="menu">
      <div ref={lista} className={estilos.lista} onKeyDown={andar}>
        <Item
          icone={<IconePararTela tamanho={18} />}
          tom="perigo"
          desabilitado={compartilhamento.ocupado}
          aoEscolher={escolher(() => void compartilhamento.alternar())}
        >
          Parar de compartilhar
        </Item>
        <span className={estilos.divisor} aria-hidden="true" />
        <Item
          icone={<IconeTrocarTela tamanho={18} />}
          desabilitado={compartilhamento.ocupado}
          aoEscolher={escolher(() => void compartilhamento.trocarDeTela())}
        >
          Trocar tela
        </Item>
        <Item icone={<IconeQualidade tamanho={18} />} aoEscolher={escolher(aoAbrirQualidade)}>
          Qualidade
        </Item>
        <Item
          icone={somNoAr ? <IconeSom tamanho={18} /> : <IconeSomMudo tamanho={18} />}
          marcado={somNoAr}
          desabilitado={!audioDaTela}
          dica={audioDaTela ? undefined : 'Esta fonte veio sem som — Trocar tela e marque "compartilhar áudio" no seletor'}
          aoEscolher={() => void compartilhamento.alternarAudioDaTela()}
        >
          Som da tela
          <span className={estilos.estado}>{!audioDaTela ? 'sem som' : somNoAr ? 'ligado' : 'calado'}</span>
        </Item>
      </div>
    </Suspenso>
  )
}
