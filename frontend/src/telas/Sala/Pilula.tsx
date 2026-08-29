import type { ReactNode } from 'react'
import type { Peca } from '../../sala/palco'
import {
  IconeCaber,
  IconeJanelinha,
  IconePixelAPixel,
  IconeSairDaTelaCheia,
  IconeTelaCheia,
} from '../../ui/Icone'
import { temPiP, temTelaCheia } from './assistir'
import estilos from './Pilula.module.css'

interface Props {
  peca: Peca
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
 * Os controles que aparecem sobre um quadro de tela, no passar do mouse e ao receber foco de
 * teclado: como assistir (zoom, janelinha, tela cheia). Quadro de pessoa não tem pílula — o
 * volume da voz, único controle que já morou aqui, vive na etiqueta, sempre à vista.
 *
 * Quem vê o quê sai do papel da peça, e de mais nada: ninguém vê botão que não pode apertar —
 * sem fixar (fixar é o clique), sem parar o que não é seu.
 *
 * O que é da SUA própria tela (trocar, o áudio dela, parar) não mora aqui: mora na barra —
 * enquanto você assiste a de outra pessoa em foco, a sua vive fora do palco, sem pílula nenhuma
 * desenhada para ela, e um botão que só existe às vezes não pode ser a única porta pra ele.
 */
export function Pilula({ peca, zoom, telaCheia, pip }: Props) {
  if (!peca.ehTela) return null

  const alheia = !peca.proprio

  return (
    <div className={estilos.pilula}>
      <Acao rotulo="Fazer a tela caber no quadro" dica="a tela inteira dentro do quadro" aoClicar={zoom.caber}>
        <IconeCaber tamanho={15} />
      </Acao>
      <Acao rotulo="Ver em 1:1" dica="tamanho original, arraste para andar por ela" aoClicar={zoom.umPorUm}>
        <IconePixelAPixel tamanho={15} />
      </Acao>

      {alheia && temPiP() && (
        <Acao
          rotulo={pip.emPiP ? 'Trazer da janelinha' : 'Ver na janelinha'}
          ligado={pip.emPiP}
          aoClicar={pip.alternar}
        >
          <IconeJanelinha tamanho={15} />
        </Acao>
      )}

      {alheia && temTelaCheia() && (
        <Acao
          rotulo={telaCheia.cheia ? 'Sair da tela cheia' : 'Ver em tela cheia'}
          dica={telaCheia.cheia ? 'sair da tela cheia' : 'ver em tela cheia (ou dê um duplo clique)'}
          ligado={telaCheia.cheia}
          aoClicar={telaCheia.alternar}
        >
          {telaCheia.cheia ? <IconeSairDaTelaCheia tamanho={15} /> : <IconeTelaCheia tamanho={15} />}
        </Acao>
      )}
    </div>
  )
}
