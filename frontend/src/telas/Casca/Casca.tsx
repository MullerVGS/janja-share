import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Credenciais } from '../../api/salas'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { enderecoDaSala } from '../../salas/link'
import { useSalasNoAr } from '../../salas/useSalasNoAr'
import { useSuasSalas } from '../../salas/useSuasSalas'
import { useSessao } from '../../sessao/sessao'
import { IconeMarca, IconeSalaDeVoz } from '../../ui/Icone'
import { DialogoCriarSala } from '../Inicio/DialogoCriarSala'
import { ColunaDeSalas } from './ColunaDeSalas'
import { Trilho } from './Trilho'
import type { SalaAtual } from './tipos'
import estilos from './Casca.module.css'

/** Abaixo disto a casca vira o app de celular: a lista (trilho + coluna) é uma tela e a página é outra. */
export const CASCA_ESTREITA = '(max-width: 720px)'

export interface AcoesDaCasca {
  criarSala(): void
}

interface Props {
  salaAtual: SalaAtual | null
  /** A página mostra o saguão (com ou sem Sala conectada por baixo). */
  noSaguao: boolean
  aoIrAoSaguao(): void
  /** Escolher a Sala atual na coluna ou no trilho: trazer a chamada de volta à página. */
  aoMostrarSalaAtual?(): void
  aoAjustarSala?(): void
  /** Painel de voz (dentro de uma Sala) e painel da pessoa, no rodapé do trilho e da coluna. */
  paineis: ReactNode
  /** A página; como função, recebe o que a casca sabe fazer por ela (abrir o criar sala). */
  pagina: ReactNode | ((acoes: AcoesDaCasca) => ReactNode)
  /** No celular: qual das duas telas está à mostra. */
  vistaNoCelular: 'lista' | 'pagina'
  /** A chamada com a janela toda: barra de título, trilho, coluna e painéis saem de cena. */
  imersao?: boolean
  /** O que fecha a coluna por baixo — o rodapé do saguão no celular. */
  rodapeDaColuna?: ReactNode
}

/**
 * A casca da interface (ADR 0016): barra de título, trilho de salas, coluna de salas com os
 * painéis flutuando no rodapé e a página à direita. É a mesma no saguão e na Sala, e por isso é
 * dona do que as duas dividem: a lista das Salas no ar, "Suas salas" e o diálogo de criar.
 */
export function Casca({
  salaAtual,
  noSaguao,
  aoIrAoSaguao,
  aoMostrarSalaAtual,
  aoAjustarSala,
  paineis,
  pagina,
  vistaNoCelular,
  imersao = false,
  rodapeDaColuna,
}: Props) {
  const navegar = useNavigate()
  const { guardar } = useSessao()
  const lista = useSalasNoAr()
  const suas = useSuasSalas()
  const [criando, setCriando] = useState(false)
  const [meuNome, setMeuNome] = useState(() => lerPreferencias().nome)

  function escolher(slug: string, assinatura?: string | null) {
    if (salaAtual?.slug === slug && aoMostrarSalaAtual) {
      aoMostrarSalaAtual()
      return
    }
    navegar(enderecoDaSala(slug, assinatura))
  }

  function abrirCriar() {
    setMeuNome(lerPreferencias().nome)
    setCriando(true)
  }

  // A coluna e o trilho reservam embaixo o tamanho dos painéis, que muda quando o painel de voz
  // entra ou sai: medido, e não chutado.
  const casca = useRef<HTMLDivElement>(null)
  const paineisRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const alvo = paineisRef.current
    if (!alvo || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => {
      casca.current?.style.setProperty('--paineis-altura', `${alvo.offsetHeight}px`)
    })
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [])

  const titulo = noSaguao || !salaAtual ? 'janja-share' : salaAtual.nome

  return (
    <div ref={casca} className={estilos.casca} data-vista={vistaNoCelular} data-imersao={imersao || undefined}>
      <header className={estilos.barraDeTitulo}>
        <span className={estilos.lugar}>
          {noSaguao || !salaAtual ? <IconeMarca tamanho={16} /> : <IconeSalaDeVoz tamanho={16} />}
          <span className={estilos.textoDoLugar}>{titulo}</span>
        </span>
      </header>

      <div className={estilos.lateral}>
        <Trilho
          suasSalas={suas.salas}
          noAr={lista.data}
          salaAtual={salaAtual}
          noSaguao={noSaguao}
          aoIrAoSaguao={aoIrAoSaguao}
          aoEscolher={(sala) => escolher(sala.slug, sala.assinatura)}
          aoCriar={abrirCriar}
        />
        <div className={estilos.coluna}>
          <ColunaDeSalas
            noAr={lista.data}
            carregando={lista.isPending}
            erro={lista.isError ? lista.error : null}
            salaAtual={salaAtual}
            aoEscolher={(slug) => escolher(slug)}
            aoAjustar={aoAjustarSala}
            rodape={rodapeDaColuna}
          />
        </div>
        <div ref={paineisRef} className={estilos.paineis}>
          {paineis}
        </div>
      </div>

      <main className={estilos.pagina}>{typeof pagina === 'function' ? pagina({ criarSala: abrirCriar }) : pagina}</main>

      <DialogoCriarSala
        aberto={criando}
        meuNome={meuNome}
        aoDefinirNome={(nome) => {
          setMeuNome(nome)
          gravarPreferencias({ nome })
        }}
        aoFechar={() => setCriando(false)}
        aoCriar={(credenciais: Credenciais) => {
          setCriando(false)
          guardar(credenciais)
          navegar(enderecoDaSala(credenciais.slug, credenciais.assinatura))
        }}
      />
    </div>
  )
}
