import type { ReactNode } from 'react'
import type { Peca } from '../../sala/palco'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { VOLUME_CHEIO, type TipoDeAudio } from '../../sala/volumes'
import {
  IconeCaber,
  IconeJanelinha,
  IconePararTela,
  IconePixelAPixel,
  IconeSairDaTelaCheia,
  IconeSom,
  IconeSomMudo,
  IconeTelaCheia,
  IconeTrocarTela,
} from '../../ui/Icone'
import { temPiP, temTelaCheia } from './assistir'
import { SomSaindo } from './SomSaindo'
import estilos from './Pilula.module.css'

interface Props {
  peca: Peca
  volumes: ControleDeVolumes
  /** O compartilhamento em curso: é dele que saem os botões da sua própria tela. */
  compartilhamento: Compartilhamento
  zoom: { caber(): void; umPorUm(): void }
  telaCheia: { cheia: boolean; alternar(): void }
  pip: { emPiP: boolean; alternar(): void }
}

function Acao({
  rotulo,
  dica,
  ligado,
  perigo = false,
  desabilitado = false,
  aoClicar,
  children,
}: {
  rotulo: string
  /** Substitui o rótulo no `title` quando há algo a explicar — tipicamente por que está apagado. */
  dica?: string
  ligado?: boolean
  perigo?: boolean
  desabilitado?: boolean
  aoClicar(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={[estilos.acao, perigo ? estilos.perigo : ''].filter(Boolean).join(' ')}
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
 * O volume daquele quadro, só neste navegador.
 *
 * A pessoa e a tela dela são duas fontes independentes — abaixar o jogo sem perder a conversa
 * é justamente o caso que dá razão ao controle.
 */
function Volume({ peca, volumes }: { peca: Peca; volumes: ControleDeVolumes }) {
  const tipo: TipoDeAudio = peca.ehTela ? 'tela' : 'pessoa'
  const alvo = peca.ehTela ? `da tela de ${peca.nome}` : `de ${peca.nome}`
  const volume = volumes.volumeDe(peca.nome, tipo)
  const mudo = volume === 0

  return (
    <>
      <Acao
        rotulo={`${mudo ? 'Devolver' : 'Calar'} o som ${alvo}`}
        ligado={mudo}
        aoClicar={() => volumes.alternarMudo(peca.nome, tipo)}
      >
        {mudo ? <IconeSomMudo tamanho={15} /> : <IconeSom tamanho={15} />}
      </Acao>
      <input
        type="range"
        className={estilos.faixaDoVolume}
        min={0}
        max={VOLUME_CHEIO}
        step={1}
        value={volume}
        aria-label={`Volume ${alvo}`}
        onChange={(evento) => volumes.definir(peca.nome, tipo, Number(evento.target.value))}
      />
    </>
  )
}

/** O áudio da sua própria tela: calar e devolver sem republicar nada. */
function AudioDaPropriaTela({ compartilhamento }: { compartilhamento: Compartilhamento }) {
  const audio = compartilhamento.audioDaTela
  const noAr = Boolean(audio && !audio.isMuted)
  const faixa = audio?.track?.mediaStreamTrack

  return (
    <>
      <Acao
        rotulo={!audio ? 'Áudio da tela' : noAr ? 'Calar o áudio da tela' : 'Devolver o áudio da tela'}
        dica={audio ? undefined : "marque 'compartilhar áudio' no seletor ao iniciar"}
        ligado={noAr}
        desabilitado={!audio}
        aoClicar={() => void compartilhamento.alternarAudioDaTela()}
      >
        {noAr ? <IconeSom tamanho={15} /> : <IconeSomMudo tamanho={15} />}
      </Acao>
      {faixa && <SomSaindo faixa={faixa} />}
    </>
  )
}

/**
 * Os controles que aparecem sobre um quadro, no passar do mouse e ao receber foco de teclado.
 *
 * Quem vê o quê sai do papel da peça, e de mais nada: ninguém vê botão que não pode apertar —
 * sem fixar (fixar é o clique), sem parar o que não é seu, sem volume do próprio som. Uma peça
 * sem nenhum botão não tem pílula.
 */
export function Pilula({ peca, volumes, compartilhamento, zoom, telaCheia, pip }: Props) {
  const propria = peca.proprio && peca.ehTela
  const alheia = !peca.proprio && peca.ehTela
  const somAlheio = !peca.proprio && peca.temAudio

  if (!peca.ehTela && !somAlheio) return null

  return (
    <div className={estilos.pilula}>
      {propria && <AudioDaPropriaTela compartilhamento={compartilhamento} />}
      {somAlheio && <Volume peca={peca} volumes={volumes} />}

      {propria && (
        <Acao rotulo="Trocar de tela" aoClicar={() => void compartilhamento.trocarDeTela()}>
          <IconeTrocarTela tamanho={15} />
        </Acao>
      )}

      {peca.ehTela && (
        <>
          <Acao rotulo="Fazer a tela caber no quadro" dica="a tela inteira dentro do quadro" aoClicar={zoom.caber}>
            <IconeCaber tamanho={15} />
          </Acao>
          <Acao rotulo="Ver em 1:1" dica="tamanho original, arraste para andar por ela" aoClicar={zoom.umPorUm}>
            <IconePixelAPixel tamanho={15} />
          </Acao>
        </>
      )}

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

      {propria && (
        <Acao rotulo="Parar de transmitir" perigo aoClicar={() => void compartilhamento.alternar()}>
          <IconePararTela tamanho={15} />
        </Acao>
      )}
    </div>
  )
}
