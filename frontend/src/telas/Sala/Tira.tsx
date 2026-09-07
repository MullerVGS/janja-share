import type { Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { IconeTelaNoAr } from '../../ui/Icone'
import { ControleDeSom } from './ControleDeSom'
import { Video } from './Midia'
import estilos from './Tira.module.css'

interface Props {
  /** As telas no ar que não estão em destaque. */
  pecas: Peca[]
  aoEscolher(chave: string): void
  volumes: ControleDeVolumes
  /** Segue o mesmo relógio das pílulas e da barra: some com a interface flutuante. */
  visivel: boolean
}

function quem(peca: Peca): string {
  return peca.proprio ? 'a sua tela' : `a tela de ${peca.nome}`
}

function rotulo(peca: Peca): string {
  return peca.proprio ? 'Sua tela' : `Tela de ${peca.nome}`
}

/**
 * A coluna de miniaturas ao lado do destaque — a faixa horizontal sob ele, no estreito.
 *
 * Cada uma é um botão: trocar o que você está assistindo não devia custar nada além de apontar
 * para a imagem que você quer. O volume vem junto no rodapé: quem assiste a uma tela em destaque
 * é exatamente quem mais precisa calar ou ajustar o som de outra — e o controle fica fora do
 * botão (botão dentro de botão não existe), então o clique nele não promove ninguém.
 */
export function Tira({ pecas, aoEscolher, volumes, visivel }: Props) {
  if (pecas.length === 0) return null

  return (
    <div className={estilos.tira} data-visivel={visivel || undefined} aria-label="Outras imagens no ar">
      {pecas.map((peca) => (
        <div key={peca.chave} className={estilos.miniatura}>
          <button
            type="button"
            className={estilos.escolher}
            aria-label={`Pôr ${quem(peca)} no palco`}
            title="Pôr no palco"
            onClick={() => aoEscolher(peca.chave)}
          >
            {peca.publicacao && <Video publicacao={peca.publicacao} className={estilos.video} />}
          </button>

          <span className={estilos.pontoAoVivo} aria-hidden="true" />

          <span className={estilos.rodape}>
            <span className={estilos.nome}>
              <span className={estilos.iconeDaTela} aria-hidden="true">
                <IconeTelaNoAr tamanho={13} />
              </span>
              {rotulo(peca)}
            </span>
            {!peca.proprio && peca.temAudio && <ControleDeSom peca={peca} volumes={volumes} />}
          </span>
        </div>
      ))}
    </div>
  )
}
