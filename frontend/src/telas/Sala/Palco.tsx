import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Peca } from '../../sala/palco'
import { useAutoOcultar } from '../../sala/useAutoOcultar'
import { useCliqueOuDuplo } from '../../sala/useCliqueOuDuplo'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { useGestosDoZoom, type ControleDeZoom } from '../../sala/useZoom'
import type { Gesto, Medidas, Zoom } from '../../sala/zoom'
import { iniciaisDoNome } from '../../ui/avatares'
import { Botao } from '../../ui/Botao'
import { IconePessoas, IconeTelaNoAr } from '../../ui/Icone'
import { usePiP, useTelaCheia } from './assistir'
import { Video } from './Midia'
import { Pilula } from './Pilula'
import { Tira } from './Tira'
import estilos from './Palco.module.css'

interface Props {
  /** O quadro que ocupa o palco; `null` quando não há imagem nenhuma no ar. */
  emDestaque: Peca | null
  /** Os outros quadros, na coluna de miniaturas — vazio na imersão. */
  miniaturas: Peca[]
  aoFocar(chave: string): void
  /** O clique único na imagem: entra e sai da imersão. */
  aoAlternarImersao(): void
  volumes: ControleDeVolumes
  /** Se a interface flutuante está à mostra — `Sala.tsx` calcula com `useAutoOcultar`; pílulas
   * e miniaturas seguem o mesmo relógio, não o hover. */
  interfaceVisivel: boolean
  zoom: ControleDeZoom
  /** Rearma o cão de guarda daquela tela — o botão do quadro que desistiu de receber. */
  aoTentarDeNovo(identidade: string): void
}

/** A pílula em tela cheia some 2 s depois do último movimento, e o hover não a governa mais. */
const OCULTAR_A_PILULA_MS = 2000

/**
 * Em tela cheia nada é desenhado até o mouse mexer.
 *
 * `useAutoOcultar` nasce visível — o que faria a pílula piscar por 2 s logo depois do duplo
 * clique, justamente a interface que ir a tela cheia pediu para não ver. O primeiro movimento
 * do ponteiro é o gatilho; daí em diante o relógio manda.
 */
function PilulasDaTelaCheia({ children }: { children: ReactNode }) {
  const [mexeu, setMexeu] = useState(false)
  const visivel = useAutoOcultar(false, OCULTAR_A_PILULA_MS)

  useEffect(() => {
    const aoMover = () => setMexeu(true)
    window.addEventListener('pointermove', aoMover, { once: true })
    return () => window.removeEventListener('pointermove', aoMover)
  }, [])

  return (
    <div className={estilos.emTelaCheia} hidden={!(mexeu && visivel)}>
      {children}
    </div>
  )
}

/**
 * A imagem: a tela leva o zoom daquela peça; a sua própria câmera vai espelhada, que é como
 * você se vê no espelho e como todo aplicativo de chamada mostra.
 */
function estiloDaImagem(peca: Peca, zoom: Zoom): CSSProperties | undefined {
  if (peca.ehTela) return { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})` }
  return peca.proprio ? { transform: 'scaleX(-1)' } : undefined
}

function nomeDoQuadro(peca: Peca): string {
  if (peca.ehTela) return peca.proprio ? 'Sua tela' : `Tela de ${peca.nome}`
  return peca.proprio ? `${peca.nome} (você)` : peca.nome
}

/**
 * O quadro em destaque: a imagem ocupando o palco, com duas pílulas no rodapé — quem é, à
 * esquerda; como assistir, à direita.
 *
 * Um clique na imagem entra na imersão (some tudo que é moldura); dois vão a tela cheia. Os
 * cliques nas pílulas não chegam aqui: elas ficam fora da moldura, que é quem escuta o ponteiro.
 */
function Destaque({
  peca,
  aoAlternarImersao,
  volumes,
  interfaceVisivel,
  zoom,
  aoTentarDeNovo,
}: Omit<Props, 'emDestaque' | 'miniaturas' | 'aoFocar'> & { peca: Peca }) {
  const quadro = useRef<HTMLDivElement>(null)
  const moldura = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const telaCheia = useTelaCheia(quadro)
  const pip = usePiP(video)

  const { aplicar } = zoom
  const aoGesto = useCallback(
    (gesto: Gesto, medidas: Medidas) => aplicar(peca.chave, gesto, medidas),
    [aplicar, peca.chave],
  )
  // Câmera não tem botão que desfaça o zoom (quadro de pessoa não tem pílula de zoom): a roda e
  // o arraste valem na tela em destaque.
  const gestos = useGestosDoZoom({ moldura, video, ativo: peca.ehTela, aoGesto })

  const clique = useCliqueOuDuplo(aoAlternarImersao, telaCheia.alternar)

  const pilulas = (
    <>
      <div className={estilos.pilulaDaIdentidade}>
        {peca.ehTela && (
          <span className={estilos.iconeDaIdentidade} aria-hidden="true">
            <IconeTelaNoAr tamanho={15} />
          </span>
        )}
        <span className={estilos.nomeDoQuadro}>{nomeDoQuadro(peca)}</span>
        {peca.ehTela && <span className={estilos.pontoAoVivo} aria-hidden="true" />}
      </div>

      <Pilula
        peca={peca}
        volumes={volumes}
        zoom={{ caber: () => gestos.disparar({ tipo: 'caber' }), umPorUm: () => gestos.disparar({ tipo: 'umPorUm' }) }}
        telaCheia={telaCheia}
        pip={pip}
      />
    </>
  )

  return (
    <div
      ref={quadro}
      className={estilos.quadro}
      data-tela={peca.ehTela || undefined}
      data-cheia={telaCheia.cheia || undefined}
      data-falando={peca.falando || undefined}
    >
      {/* A moldura é a área da imagem: é nela que o clique, o duplo clique e os gestos do zoom
          caem. As pílulas ficam de fora, e por isso seguem clicáveis. */}
      <div
        ref={moldura}
        className={estilos.moldura}
        data-imagem=""
        title="1 clique esconde os painéis · 2 cliques: tela cheia"
        onPointerDown={(evento) => {
          gestos.ponteiro.onPointerDown(evento)
          clique.onPointerDown(evento)
        }}
        onPointerMove={gestos.ponteiro.onPointerMove}
        onPointerUp={(evento) => {
          gestos.ponteiro.onPointerUp(evento)
          clique.onPointerUp(evento)
        }}
        onPointerCancel={gestos.ponteiro.onPointerCancel}
      >
        {peca.publicacao ? (
          <Video
            publicacao={peca.publicacao}
            className={estilos.video}
            estilo={estiloDaImagem(peca, zoom.de(peca.chave))}
            referencia={video}
          />
        ) : (
          <div className={estilos.semVideo}>
            <span className={estilos.iniciais}>{iniciaisDoNome(peca.nome)}</span>
          </div>
        )}
      </div>

      {pip.emPiP && <span className={estilos.emPiP}>em PiP</span>}

      {peca.recepcao === 'retomando' && (
        <p className={estilos.avisoDaRecepcao} role="status">
          <span className={estilos.textoDaRecepcao}>a tela de {peca.nome} ainda não chegou aqui — tentando de novo…</span>
        </p>
      )}
      {/* Três reassinaturas sem resposta não viram uma quarta sozinhas — mas quem está olhando o
          retângulo preto tem de poder mandar tentar de novo sem depender de quem transmite. */}
      {peca.recepcao === 'desistiu' && (
        <p className={estilos.avisoDaRecepcao} role="status">
          <span className={estilos.textoDaRecepcao}>a tela de {peca.nome} nunca chegou aqui.</span>
          <Botao
            aparencia="fantasma"
            className={estilos.tentarDeNovo}
            onClick={() => aoTentarDeNovo(peca.identidade)}
          >
            Tentar de novo
          </Botao>
        </p>
      )}

      {telaCheia.cheia ? (
        <PilulasDaTelaCheia>{pilulas}</PilulasDaTelaCheia>
      ) : (
        // A pílula segue a interface flutuante, não o hover: sumiu tudo, ela some junto — sem
        // isso ela ficaria a única peça de UI ainda visível na tela parada.
        interfaceVisivel && <div className={estilos.comAInterface}>{pilulas}</div>
      )}
    </div>
  )
}

/**
 * O palco: um quadro em destaque ocupando o espaço e as outras imagens em miniatura ao lado.
 *
 * Quem decide o destaque é `foco.ts`; aqui só se desenha. Não há mais grade: pessoa sem imagem
 * mora na faixa de avatares e na barra lateral, não em um retângulo do tamanho de uma tela.
 */
export function Palco({
  emDestaque,
  miniaturas,
  aoFocar,
  aoAlternarImersao,
  volumes,
  interfaceVisivel,
  zoom,
  aoTentarDeNovo,
}: Props) {
  return (
    <div className={estilos.palco} data-modo={emDestaque ? 'destaque' : 'vazio'}>
      {emDestaque ? (
        <Destaque
          key={emDestaque.chave}
          peca={emDestaque}
          aoAlternarImersao={aoAlternarImersao}
          volumes={volumes}
          interfaceVisivel={interfaceVisivel}
          zoom={zoom}
          aoTentarDeNovo={aoTentarDeNovo}
        />
      ) : (
        <div className={estilos.vazio}>
          <span className={estilos.iconeVazio} aria-hidden="true">
            <IconePessoas tamanho={26} />
          </span>
          <strong>Nada no ar ainda.</strong>
          <span>Convide alguém ou comece a compartilhar sua tela.</span>
        </div>
      )}

      <Tira pecas={miniaturas} aoEscolher={aoFocar} volumes={volumes} visivel={interfaceVisivel} />
    </div>
  )
}
