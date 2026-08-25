import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { iniciais, type Peca } from '../../sala/palco'
import { useAutoOcultar } from '../../sala/useAutoOcultar'
import { useCliqueOuDuplo } from '../../sala/useCliqueOuDuplo'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { useGestosDoZoom, type ControleDeZoom } from '../../sala/useZoom'
import type { Gesto, Medidas, Zoom } from '../../sala/zoom'
import { Botao } from '../../ui/Botao'
import { IconeMicrofoneMudo, IconePessoas } from '../../ui/Icone'
import { usePiP, useTelaCheia } from './assistir'
import { useCrescerEEncolher } from './transicao'
import { ControleDeSom } from './ControleDeSom'
import { Video } from './Midia'
import { Pilula } from './Pilula'
import estilos from './Palco.module.css'

interface Props {
  /** O que está no palco: a grade inteira, ou só a peça em foco. */
  pecas: Peca[]
  emFoco: boolean
  aoSoltarOFoco(): void
  aoFocar(chave: string): void
  volumes: ControleDeVolumes
  /** Se a interface flutuante (Cabecalho, Controles) está à mostra — `Sala.tsx` já calcula isso
   * com `useAutoOcultar`; a pílula do quadro em foco segue o mesmo relógio, não o hover. */
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
function PilulaDaTelaCheia({ children }: { children: ReactNode }) {
  const [mexeu, setMexeu] = useState(false)
  const visivel = useAutoOcultar(false, OCULTAR_A_PILULA_MS)

  useEffect(() => {
    const aoMover = () => setMexeu(true)
    window.addEventListener('pointermove', aoMover, { once: true })
    return () => window.removeEventListener('pointermove', aoMover)
  }, [])

  return (
    <div className={estilos.naTelaCheia} hidden={!(mexeu && visivel)}>
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

function Quadro({
  peca,
  emFoco,
  aoSoltarOFoco,
  aoFocar,
  volumes,
  interfaceVisivel,
  zoom,
  aoTentarDeNovo,
}: Omit<Props, 'pecas'> & { peca: Peca }) {
  const quadro = useRef<HTMLDivElement>(null)
  const moldura = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const telaCheia = useTelaCheia(quadro)
  const pip = usePiP(video)
  // A peça que entra na grade cresce pela animação de montagem; a que estava em foco não remonta,
  // e é esta que a faz encolher em vez de saltar.
  useCrescerEEncolher(quadro, emFoco)

  const { aplicar } = zoom
  const aoGesto = useCallback(
    (gesto: Gesto, medidas: Medidas) => aplicar(peca.chave, gesto, medidas),
    [aplicar, peca.chave],
  )
  // Aproximar uma miniatura da grade seria gesto sem propósito, e câmera não tem botão que
  // desfaça o zoom (a pílula dela só regula som): a roda e o arraste valem na tela em foco.
  const gestos = useGestosDoZoom({
    moldura,
    video,
    ativo: peca.ehTela && (emFoco || telaCheia.cheia),
    aoGesto,
  })

  const clique = useCliqueOuDuplo(
    () => (emFoco ? aoSoltarOFoco() : aoFocar(peca.chave)),
    telaCheia.alternar,
  )

  const pilula = (
    <Pilula
      peca={peca}
      volumes={volumes}
      zoom={{ caber: () => gestos.disparar({ tipo: 'caber' }), umPorUm: () => gestos.disparar({ tipo: 'umPorUm' }) }}
      telaCheia={telaCheia}
      pip={pip}
    />
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
          caem. A etiqueta e a pílula ficam de fora, e por isso seguem clicáveis. */}
      <div
        ref={moldura}
        className={estilos.moldura}
        data-imagem=""
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
            <span className={estilos.iniciais}>{iniciais(peca.nome)}</span>
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

      <div className={estilos.etiqueta}>
        {!peca.ehTela && !peca.microfoneLigado && (
          <span className={estilos.microfoneFechado} title="microfone fechado">
            <IconeMicrofoneMudo tamanho={13} />
          </span>
        )}
        <span className={estilos.nome}>
          {peca.nome}
          {peca.proprio && ' (você)'}
          {peca.ehTela && ' · tela'}
        </span>
        {!peca.proprio && peca.ehTela && peca.temAudio && (
          <ControleDeSom peca={peca} volumes={volumes} compacto />
        )}
        {!peca.proprio && peca.temAudio && volumes.volumeDe(peca.nome, peca.ehTela ? 'tela' : 'pessoa') === 0 && (
          <span className={estilos.selodeMudo}>mudo</span>
        )}
      </div>

      {telaCheia.cheia ? (
        <PilulaDaTelaCheia>{pilula}</PilulaDaTelaCheia>
      ) : emFoco ? (
        // Em foco a pílula segue a interface flutuante, não o hover: sumiu tudo, ela some
        // junto — sem isso ela ficaria a única peça de UI ainda visível na tela parada.
        interfaceVisivel && <div className={estilos.comAInterface}>{pilula}</div>
      ) : (
        <div className={estilos.aoPassarOMouse}>{pilula}</div>
      )}
    </div>
  )
}

/**
 * O palco em dois estados: uma peça ocupando tudo, ou a grade com tudo que existe na sala.
 *
 * Quem decide qual é `foco.ts`; aqui só se desenha. A peça em foco continua sendo o mesmo
 * quadro que estava na grade (mesma chave, mesmo pai), e é isso que impede o vídeo de piscar
 * ao entrar e sair do foco.
 */
export function Palco({ pecas, emFoco, aoSoltarOFoco, aoFocar, volumes, interfaceVisivel, zoom, aoTentarDeNovo }: Props) {
  return (
    <div className={estilos.palco} data-modo={emFoco ? 'foco' : 'grade'}>
      {pecas.map((peca) => (
        <Quadro
          key={peca.chave}
          peca={peca}
          emFoco={emFoco}
          aoSoltarOFoco={aoSoltarOFoco}
          aoFocar={aoFocar}
          volumes={volumes}
          interfaceVisivel={interfaceVisivel}
          zoom={zoom}
          aoTentarDeNovo={aoTentarDeNovo}
        />
      ))}
      {pecas.length === 0 && (
        <div className={estilos.vazio}>
          <span className={estilos.iconeVazio} aria-hidden="true">
            <IconePessoas tamanho={30} />
          </span>
          <strong>Você é a primeira pessoa aqui.</strong>
          <span>Convide alguém ou comece a compartilhar sua tela.</span>
        </div>
      )}
    </div>
  )
}
