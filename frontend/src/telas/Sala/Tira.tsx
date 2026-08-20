import { iniciais, type Peca } from '../../sala/palco'
import { Video } from './Midia'
import estilos from './Tira.module.css'

interface Props {
  /** Quem existe na sala e não está no palco; vazio na grade, onde tudo já está lá. */
  pecas: Peca[]
  aoEscolher(chave: string): void
}

function quem(peca: Peca): string {
  if (peca.ehTela) return peca.proprio ? 'a sua tela' : `a tela de ${peca.nome}`
  return peca.proprio ? 'você' : peca.nome
}

/**
 * As miniaturas de quem ficou fora do palco, no alto à direita. Cada uma é um botão: trocar o
 * que você está assistindo não devia custar uma volta pela grade.
 */
export function Tira({ pecas, aoEscolher }: Props) {
  if (pecas.length === 0) return null

  return (
    <div className={estilos.tira}>
      {pecas.map((peca) => (
        <button
          key={peca.chave}
          type="button"
          className={estilos.miniatura}
          data-tela={peca.ehTela || undefined}
          data-falando={peca.falando || undefined}
          aria-label={`Pôr ${quem(peca)} no palco`}
          onClick={() => aoEscolher(peca.chave)}
        >
          {peca.publicacao ? (
            <Video
              publicacao={peca.publicacao}
              className={estilos.video}
              espelhar={peca.proprio && !peca.ehTela}
            />
          ) : (
            <span className={estilos.iniciais}>{iniciais(peca.nome)}</span>
          )}
          <span className={estilos.nome}>
            {peca.nome}
            {peca.ehTela && ' · tela'}
          </span>
        </button>
      ))}
    </div>
  )
}
