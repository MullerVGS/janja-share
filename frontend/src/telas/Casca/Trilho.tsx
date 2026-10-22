import type { SalaNaLista } from '../../api/salas'
import { iniciaisDoNome } from '../../ui/avatares'
import { IconeMais, IconeMarca } from '../../ui/Icone'
import type { SalaLembrada } from '../../salas/suasSalas'
import type { SalaAtual } from './tipos'
import estilos from './Trilho.module.css'

interface Props {
  suasSalas: SalaLembrada[]
  noAr: SalaNaLista[] | undefined
  salaAtual: SalaAtual | null
  /** O saguão está à mostra na página. */
  noSaguao: boolean
  aoIrAoSaguao(): void
  aoEscolher(sala: SalaLembrada): void
  aoCriar(): void
}

function frasePessoas(quantas: number): string {
  return quantas === 1 ? '1 pessoa agora' : `${quantas} pessoas agora`
}

/**
 * O trilho da esquerda: o saguão no alto, um traço, "Suas salas" em ícones com as iniciais e,
 * por último, o "+" de criar. A pílula branca na borda diz o estado de cada ícone: alta na Sala à
 * mostra, média sob o ponteiro, um ponto na Sala que tem gente agora.
 *
 * A Sala em que a pessoa está entra no trilho mesmo antes de "Suas salas" se lembrar dela: o
 * trilho é o mapa de onde se está.
 */
export function Trilho({ suasSalas, noAr, salaAtual, noSaguao, aoIrAoSaguao, aoEscolher, aoCriar }: Props) {
  const salas: SalaLembrada[] =
    salaAtual?.fixa && !suasSalas.some((sala) => sala.slug === salaAtual.slug)
      ? [
          {
            slug: salaAtual.slug,
            nome: salaAtual.nome,
            privada: salaAtual.privada,
            assinatura: salaAtual.assinatura,
            em: Date.now(),
          },
          ...suasSalas,
        ]
      : suasSalas

  return (
    <nav className={estilos.trilho} aria-label="Suas salas">
      <div className={estilos.item}>
        <span className={estilos.pilula} data-estado={noSaguao ? 'escolhido' : undefined} aria-hidden="true" />
        <button
          type="button"
          className={estilos.icone}
          data-saguao=""
          aria-current={noSaguao ? 'page' : undefined}
          aria-label="Saguão"
          title="Saguão"
          onClick={aoIrAoSaguao}
        >
          <IconeMarca tamanho={24} />
        </button>
      </div>

      <span className={estilos.separador} aria-hidden="true" />

      {salas.map((sala) => {
        const atual = salaAtual?.slug === sala.slug
        const escolhida = atual && salaAtual.aMostra
        const pessoas = atual ? salaAtual.pessoas.length : (noAr?.find((viva) => viva.slug === sala.slug)?.pessoas.length ?? 0)
        const dica = pessoas > 0 ? `${sala.nome} · ${frasePessoas(pessoas)}` : sala.nome
        return (
          <div key={sala.slug} className={estilos.item}>
            <span
              className={estilos.pilula}
              data-estado={escolhida ? 'escolhido' : pessoas > 0 ? 'comGente' : undefined}
              aria-hidden="true"
            />
            <button
              type="button"
              className={estilos.icone}
              aria-current={escolhida ? 'page' : undefined}
              aria-label={dica}
              title={dica}
              onClick={() => aoEscolher(sala)}
            >
              {iniciaisDoNome(sala.nome)}
            </button>
          </div>
        )
      })}

      <div className={estilos.item}>
        <span className={estilos.pilula} aria-hidden="true" />
        <button type="button" className={estilos.icone} data-criar="" aria-label="Criar uma sala" title="Criar uma sala" onClick={aoCriar}>
          <IconeMais tamanho={20} />
        </button>
      </div>
    </nav>
  )
}
