import { iniciais, type Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { ControleDeSom } from './ControleDeSom'
import { Video } from './Midia'
import estilos from './Tira.module.css'

interface Props {
  /** Quem existe na sala e não está no palco; vazio na grade, onde tudo já está lá. */
  pecas: Peca[]
  aoEscolher(chave: string): void
  volumes: ControleDeVolumes
}

function quem(peca: Peca): string {
  if (peca.ehTela) return peca.proprio ? 'a sua tela' : `a tela de ${peca.nome}`
  return peca.proprio ? 'você' : peca.nome
}

/**
 * As miniaturas de quem ficou fora do palco, no alto à direita. Cada uma é um botão: trocar o
 * que você está assistindo não devia custar uma volta pela grade.
 *
 * O volume vem junto: quem assiste a uma tela em foco é exatamente quem mais precisa calar ou
 * ajustar uma voz — e não pode ter que sair do foco para isso. O controle fica fora do botão
 * (botão dentro de botão não existe) e o clique nele não promove ninguém ao palco.
 */
export function Tira({ pecas, aoEscolher, volumes }: Props) {
  if (pecas.length === 0) return null

  return (
    <div className={estilos.tira}>
      {pecas.map((peca) => (
        <div key={peca.chave} className={estilos.miniatura} data-falando={peca.falando || undefined}>
          <button
            type="button"
            className={estilos.escolher}
            aria-label={`Pôr ${quem(peca)} no palco`}
            onClick={() => aoEscolher(peca.chave)}
          >
            {peca.publicacao ? (
              <Video
                publicacao={peca.publicacao}
                className={estilos.video}
                estilo={peca.proprio && !peca.ehTela ? { transform: 'scaleX(-1)' } : undefined}
              />
            ) : (
              <span className={estilos.iniciais}>{iniciais(peca.nome)}</span>
            )}
          </button>
          <span className={estilos.rodape}>
            <span className={estilos.nome}>
              {peca.nome}
              {peca.ehTela && ' · tela'}
            </span>
            {!peca.proprio && peca.temAudio && <ControleDeSom peca={peca} volumes={volumes} />}
          </span>
        </div>
      ))}
    </div>
  )
}
