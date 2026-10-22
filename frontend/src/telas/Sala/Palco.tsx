import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ConnectionState } from 'livekit-client'
import { estadoDoQuadro, type EstadoDoQuadro, type Peca } from '../../sala/palco'
import { useAutoOcultar } from '../../sala/useAutoOcultar'
import { useCliqueOuDuplo } from '../../sala/useCliqueOuDuplo'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { useGestosDoZoom, type ControleDeZoom } from '../../sala/useZoom'
import type { Gesto, Medidas, Zoom } from '../../sala/zoom'
import { Botao } from '../../ui/Botao'
import { IconePessoas, IconeTelaNoAr } from '../../ui/Icone'
import { usePiP, useTelaCheia } from './assistir'
import { Video } from './Midia'
import { Pilula } from './Pilula'
import { Tira } from './Tira'
import estilos from './Palco.module.css'

interface Props {
  /** A tela que ocupa o palco; `null` quando não há tela nenhuma no ar. */
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
  /** Na imersão o quadro fica com a janela toda: sem o respiro que a faixa de avatares e a barra
   * ocupam no modo normal, e sem moldura — o CSS lê a marca que isto vira. */
  imersao: boolean
  zoom: ControleDeZoom
  /** Rearma o cão de guarda daquela tela — o botão do quadro que desistiu de receber. */
  aoTentarDeNovo(identidade: string): void
  /** A conexão desta pessoa com a Sala: caída, todo quadro diz isso antes de qualquer coisa. */
  minhaConexao: ConnectionState
  /** O Fechar do quadro cuja Tela terminou. */
  aoFecharEncerrada(): void
  /** Desassina a Tela daquela Pessoa sem sair da Sala; `aoVerDeNovo` assina de volta. */
  aoDeixarDeVer(identidade: string): void
  aoVerDeNovo(identidade: string): void
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
  const [visivel] = useAutoOcultar(false, OCULTAR_A_PILULA_MS)

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

/** O que o cartão diz em cada estado, e a cor: atenção é o que não deveria estar acontecendo. */
function textoDoEstado(estado: EstadoDoQuadro, peca: Peca): { texto: string; tom: 'neutro' | 'atencao' } | null {
  const de = peca.proprio ? 'Sua tela' : `A tela de ${peca.nome}`
  switch (estado) {
    case 'aoVivo':
      return null
    case 'voceReconectando':
      return { texto: 'Sua conexão caiu — voltando…', tom: 'atencao' }
    case 'terminou':
      return { texto: `${de} terminou.`, tom: 'neutro' }
    case 'naoVejo':
      return { texto: `Você deixou de ver a tela de ${peca.nome}.`, tom: 'neutro' }
    case 'donoReconectando':
      return { texto: `A conexão de ${peca.nome} caiu — esperando voltar…`, tom: 'atencao' }
    case 'pausada':
      return {
        texto: `${de} está pausada — a janela compartilhada pode estar minimizada.`,
        tom: 'neutro',
      }
    case 'chegando':
      return { texto: `a tela de ${peca.nome} ainda não chegou aqui — tentando de novo…`, tom: 'atencao' }
    case 'nuncaChegou':
      return { texto: `a tela de ${peca.nome} nunca chegou aqui.`, tom: 'atencao' }
    case 'congelada':
      return { texto: `A imagem de ${peca.nome} parou de chegar aqui.`, tom: 'atencao' }
  }
}

/**
 * O cartão por cima do quadro: o que está acontecendo com aquela Tela, em uma frase, e a saída
 * quando há uma. Quem decide o estado é `estadoDoQuadro`; aqui só se escreve.
 */
function CartaoDeEstado({
  estado,
  peca,
  aoTentarDeNovo,
  aoFechar,
  aoVerDeNovo,
}: {
  estado: EstadoDoQuadro
  peca: Peca
  aoTentarDeNovo(identidade: string): void
  aoFechar(): void
  aoVerDeNovo(identidade: string): void
}) {
  const conteudo = textoDoEstado(estado, peca)
  if (!conteudo) return null
  // Três reassinaturas sem resposta não viram uma quarta sozinhas — mas quem está olhando o
  // retângulo parado tem de poder mandar tentar de novo sem depender de quem transmite.
  const podeTentar = estado === 'nuncaChegou' || estado === 'congelada'
  return (
    <div className={estilos.cartaoDeEstado} data-estado={estado}>
      <div className={estilos.caixaDoEstado} role="status" data-tom={conteudo.tom}>
        <span>{conteudo.texto}</span>
        {(podeTentar || estado === 'terminou' || estado === 'naoVejo') && (
          <div className={estilos.acoesDoEstado}>
            {podeTentar && (
              <Botao aparencia="secundario" onClick={() => aoTentarDeNovo(peca.identidade)}>
                Tentar de novo
              </Botao>
            )}
            {estado === 'terminou' && (
              <Botao aparencia="secundario" onClick={aoFechar}>
                Fechar
              </Botao>
            )}
            {estado === 'naoVejo' && (
              <Botao aparencia="secundario" onClick={() => aoVerDeNovo(peca.identidade)}>
                Ver de novo
              </Botao>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** A imagem leva o zoom daquela tela. */
function estiloDaImagem(zoom: Zoom): CSSProperties {
  return { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})` }
}

function nomeDoQuadro(peca: Peca): string {
  return peca.proprio ? 'Sua tela' : `Tela de ${peca.nome}`
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
  minhaConexao,
  aoFecharEncerrada,
  aoDeixarDeVer,
  aoVerDeNovo,
}: Omit<Props, 'emDestaque' | 'miniaturas' | 'aoFocar' | 'imersao'> & { peca: Peca }) {
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
  const gestos = useGestosDoZoom({ moldura, video, aoGesto })

  const clique = useCliqueOuDuplo(aoAlternarImersao, telaCheia.alternar)

  const pilulas = (
    <>
      <div className={estilos.pilulaDaIdentidade}>
        <span className={estilos.iconeDaIdentidade} aria-hidden="true">
          <IconeTelaNoAr tamanho={15} />
        </span>
        <span className={estilos.nomeDoQuadro}>{nomeDoQuadro(peca)}</span>
        <span className={estilos.pontoAoVivo} aria-hidden="true" />
      </div>

      <Pilula
        peca={peca}
        volumes={volumes}
        zoom={{ caber: () => gestos.disparar({ tipo: 'caber' }), umPorUm: () => gestos.disparar({ tipo: 'umPorUm' }) }}
        telaCheia={telaCheia}
        pip={pip}
        aoAlternarVer={() => (peca.naoVejo ? aoVerDeNovo(peca.identidade) : aoDeixarDeVer(peca.identidade))}
      />
    </>
  )

  return (
    <div
      ref={quadro}
      className={estilos.quadro}
      data-tela=""
      data-cheia={telaCheia.cheia || undefined}
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
        {peca.publicacao && (
          <Video
            publicacao={peca.publicacao}
            className={estilos.video}
            estilo={estiloDaImagem(zoom.de(peca.chave))}
            referencia={video}
          />
        )}
      </div>

      {pip.emPiP && <span className={estilos.emPiP}>em PiP</span>}

      <CartaoDeEstado
        estado={estadoDoQuadro(peca, minhaConexao)}
        peca={peca}
        aoTentarDeNovo={aoTentarDeNovo}
        aoFechar={aoFecharEncerrada}
        aoVerDeNovo={aoVerDeNovo}
      />

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
 * O palco: uma tela em destaque ocupando o espaço e as outras em miniatura ao lado.
 *
 * Quem decide o destaque é `foco.ts`; aqui só se desenha. Não há grade nem quadro de pessoa:
 * presença mora na faixa de avatares e na barra lateral, não em um retângulo do tamanho de uma
 * tela.
 */
export function Palco({
  emDestaque,
  miniaturas,
  aoFocar,
  aoAlternarImersao,
  volumes,
  interfaceVisivel,
  imersao,
  zoom,
  aoTentarDeNovo,
  minhaConexao,
  aoFecharEncerrada,
  aoDeixarDeVer,
  aoVerDeNovo,
}: Props) {
  return (
    <div className={estilos.palco} data-modo={emDestaque ? 'destaque' : 'vazio'} data-imersao={imersao || undefined}>
      {emDestaque ? (
        <Destaque
          key={emDestaque.chave}
          peca={emDestaque}
          aoAlternarImersao={aoAlternarImersao}
          volumes={volumes}
          interfaceVisivel={interfaceVisivel}
          zoom={zoom}
          aoTentarDeNovo={aoTentarDeNovo}
          minhaConexao={minhaConexao}
          aoFecharEncerrada={aoFecharEncerrada}
          aoDeixarDeVer={aoDeixarDeVer}
          aoVerDeNovo={aoVerDeNovo}
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
