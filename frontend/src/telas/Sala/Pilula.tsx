import type { ReactNode } from 'react'
import type { Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import {
  IconeCaber,
  IconeJanelinha,
  IconePixelAPixel,
  IconeSairDaTelaCheia,
  IconeTelaCheia,
} from '../../ui/Icone'
import { temPiP, temTelaCheia } from './assistir'
import { ControleDeSom } from './ControleDeSom'
import estilos from './Pilula.module.css'

interface Props {
  peca: Peca
  volumes: ControleDeVolumes
  zoom: { caber(): void; umPorUm(): void }
  telaCheia: { cheia: boolean; alternar(): void }
  pip: { emPiP: boolean; alternar(): void }
}

function Acao({
  rotulo,
  dica,
  ligado,
  desabilitado = false,
  aoClicar,
  children,
}: {
  rotulo: string
  /** Substitui o rótulo no `title` quando há algo a explicar — tipicamente por que está apagado. */
  dica?: string
  ligado?: boolean
  desabilitado?: boolean
  aoClicar(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={estilos.acao}
      aria-pressed={ligado}
      aria-label={rotulo}
      title={dica ?? rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      {children}
    </button>
  )
}

/**
 * A pílula inferior direita do quadro em destaque: como assistir aquilo.
 *
 * Volume, zoom, janelinha e tela cheia — tudo que muda o *seu* jeito de ver, e nada que mude o
 * que os outros veem. O que é da SUA própria tela (trocar, o áudio dela, parar) mora na barra:
 * enquanto você assiste a de outra pessoa em destaque, a sua vive na coluna de miniaturas, sem
 * pílula nenhuma desenhada para ela, e um botão que só existe às vezes não pode ser a única
 * porta pra ele.
 */
export function Pilula({ peca, volumes, zoom, telaCheia, pip }: Props) {
  const alheia = !peca.proprio
  const comSom = alheia && peca.temAudio
  const comZoom = peca.ehTela
  const comJanela = alheia && (temPiP() || temTelaCheia())

  if (!comSom && !comZoom && !comJanela) return null

  return (
    <div className={estilos.pilula}>
      {comSom && <ControleDeSom peca={peca} volumes={volumes} />}

      {comSom && comZoom && <span className={estilos.separador} aria-hidden="true" />}

      {comZoom && (
        <>
          <Acao rotulo="Fazer a tela caber no quadro" dica="a tela inteira dentro do quadro" aoClicar={zoom.caber}>
            <IconeCaber tamanho={16} />
          </Acao>
          <Acao rotulo="Ver em 1:1" dica="tamanho original, arraste para andar por ela" aoClicar={zoom.umPorUm}>
            <IconePixelAPixel tamanho={16} />
          </Acao>
        </>
      )}

      {comJanela && (comSom || comZoom) && <span className={estilos.separador} aria-hidden="true" />}

      {alheia && temPiP() && (
        <Acao
          rotulo={pip.emPiP ? 'Trazer da janelinha' : 'Ver na janelinha'}
          ligado={pip.emPiP}
          aoClicar={pip.alternar}
        >
          <IconeJanelinha tamanho={16} />
        </Acao>
      )}

      {alheia && temTelaCheia() && (
        <Acao
          rotulo={telaCheia.cheia ? 'Sair da tela cheia' : 'Ver em tela cheia'}
          dica={telaCheia.cheia ? 'sair da tela cheia' : 'ver em tela cheia (ou dê um duplo clique)'}
          ligado={telaCheia.cheia}
          aoClicar={telaCheia.alternar}
        >
          {telaCheia.cheia ? <IconeSairDaTelaCheia tamanho={16} /> : <IconeTelaCheia tamanho={16} />}
        </Acao>
      )}
    </div>
  )
}
