import { useRef } from 'react'
import { iniciais, type Palco as EstadoDoPalco, type Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { VOLUME_CHEIO, type TipoDeAudio } from '../../sala/volumes'
import {
  IconeCaber,
  IconeFixar,
  IconeJanelinha,
  IconeMicrofoneMudo,
  IconePixelAPixel,
  IconeSairDaTelaCheia,
  IconeSom,
  IconeSomMudo,
  IconeTelaCheia,
} from '../../ui/Icone'
import {
  AJUSTES,
  outroAjuste,
  temPiP,
  temTelaCheia,
  useArraste,
  usePiP,
  useTelaCheia,
  type Ajuste,
} from './assistir'
import { Video } from './Midia'
import estilos from './Palco.module.css'

interface Props {
  palco: EstadoDoPalco
  /** Chave da tela travada em foco, ou `null` para o arranjo automático. */
  fixada: string | null
  aoFixar(chave: string | null): void
  volumes: ControleDeVolumes
  /** Como as telas aparecem: cabendo no quadro ou no tamanho original. Vale para todas. */
  ajuste: Ajuste
  aoAjustar(ajuste: Ajuste): void
}

/**
 * O volume daquele quadro, só neste navegador. Aparece no passar do mouse (e ao receber foco
 * pelo teclado): é ajuste de exceção, não moldura permanente.
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
    <div className={estilos.volume}>
      <button
        type="button"
        className={estilos.mudo}
        aria-pressed={mudo}
        aria-label={`${mudo ? 'Devolver' : 'Calar'} o som ${alvo}`}
        title={`${mudo ? 'devolver' : 'calar'} o som ${alvo}`}
        onClick={() => volumes.alternarMudo(peca.nome, tipo)}
      >
        {mudo ? <IconeSomMudo tamanho={14} /> : <IconeSom tamanho={14} />}
      </button>
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
    </div>
  )
}

function Quadro({
  peca,
  fixada,
  aoFixar,
  volumes,
  ajuste,
  aoAjustar,
  miniatura = false,
}: {
  peca: Peca
  fixada: string | null
  aoFixar(chave: string | null): void
  volumes: ControleDeVolumes
  ajuste: Ajuste
  aoAjustar(ajuste: Ajuste): void
  miniatura?: boolean
}) {
  const estaFixada = fixada === peca.chave
  const quadro = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const telaCheia = useTelaCheia(quadro)
  const pip = usePiP(video)
  const arraste = useArraste(peca.ehTela && ajuste === 'pixelAPixel')

  return (
    <div
      ref={quadro}
      className={[estilos.quadro, miniatura ? estilos.miniatura : '', peca.falando ? estilos.falando : '']
        .filter(Boolean)
        .join(' ')}
      data-tela={peca.ehTela || undefined}
      data-cheia={telaCheia.cheia || undefined}
    >
      {/* A moldura é a área da imagem: é ela que rola quando a tela vai maior que o quadro, e é
          nela que o duplo clique cai — os botões e a etiqueta ficam de fora, e por isso seguem
          clicáveis em tela cheia. */}
      <div
        className={estilos.moldura}
        data-ajuste={peca.ehTela ? ajuste : undefined}
        onDoubleClick={peca.ehTela ? telaCheia.alternar : undefined}
        {...arraste}
      >
        {peca.publicacao ? (
          <Video
            publicacao={peca.publicacao}
            className={estilos.video}
            espelhar={peca.proprio && !peca.ehTela}
            referencia={video}
          />
        ) : (
          <div className={estilos.semVideo}>
            <span className={estilos.iniciais}>{iniciais(peca.nome)}</span>
          </div>
        )}
      </div>

      {pip.emPiP && <span className={estilos.emPiP}>em PiP</span>}

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
      </div>

      {peca.ehTela && (
        <div className={estilos.acoes}>
          <button
            type="button"
            className={estilos.acao}
            aria-pressed={ajuste === 'pixelAPixel'}
            aria-label={`Ver em ${AJUSTES[outroAjuste(ajuste)].rotulo.toLowerCase()}`}
            title={AJUSTES[outroAjuste(ajuste)].explicacao}
            onClick={() => aoAjustar(outroAjuste(ajuste))}
          >
            {ajuste === 'pixelAPixel' ? <IconeCaber tamanho={15} /> : <IconePixelAPixel tamanho={15} />}
          </button>

          {temPiP() && (
            <button
              type="button"
              className={estilos.acao}
              aria-pressed={pip.emPiP}
              aria-label={pip.emPiP ? 'Trazer da janelinha' : 'Ver na janelinha'}
              title={pip.emPiP ? 'trazer de volta da janelinha' : 'ver na janelinha flutuante'}
              onClick={pip.alternar}
            >
              <IconeJanelinha tamanho={15} />
            </button>
          )}

          {temTelaCheia() && (
            <button
              type="button"
              className={estilos.acao}
              aria-pressed={telaCheia.cheia}
              aria-label={telaCheia.cheia ? 'Sair da tela cheia' : 'Ver em tela cheia'}
              title={telaCheia.cheia ? 'sair da tela cheia' : 'ver em tela cheia (ou dê um duplo clique)'}
              onClick={telaCheia.alternar}
            >
              {telaCheia.cheia ? <IconeSairDaTelaCheia tamanho={15} /> : <IconeTelaCheia tamanho={15} />}
            </button>
          )}

          <button
            type="button"
            className={estilos.acao}
            aria-pressed={estaFixada}
            aria-label={estaFixada ? 'Soltar do foco' : 'Fixar em foco'}
            title={estaFixada ? 'soltar do foco' : 'fixar em foco'}
            onClick={() => aoFixar(estaFixada ? null : peca.chave)}
          >
            <IconeFixar tamanho={15} />
          </button>
        </div>
      )}

      {/* O próprio som não se regula daqui: quem manda não se ouve. */}
      {!peca.proprio && peca.temAudio && <Volume peca={peca} volumes={volumes} />}
    </div>
  )
}

/**
 * A grade.
 *
 * Regra de arranjo, em ordem: uma tela fixada manda em tudo e fica sozinha no palco; senão,
 * havendo telas, o palco é delas e as pessoas descem para a tira; sem tela nenhuma, o palco é
 * das pessoas. Compartilhar tela é a razão de existir desta sala — o layout diz isso.
 */
export function Palco({ palco, fixada, aoFixar, volumes, ajuste, aoAjustar }: Props) {
  const emDestaque = fixada === null ? undefined : palco.telas.find((tela) => tela.chave === fixada)

  let principais: Peca[]
  let tira: Peca[]
  let modo: 'destaque' | 'telas' | 'pessoas'

  if (emDestaque) {
    modo = 'destaque'
    principais = [emDestaque]
    tira = [...palco.telas.filter((tela) => tela.chave !== emDestaque.chave), ...palco.pessoas]
  } else if (palco.telas.length > 0) {
    modo = 'telas'
    principais = palco.telas
    tira = palco.pessoas
  } else {
    modo = 'pessoas'
    principais = palco.pessoas
    tira = []
  }

  return (
    <div className={estilos.palco}>
      <div className={estilos.principal} data-modo={modo}>
        {principais.map((peca) => (
          <Quadro
            key={peca.chave}
            peca={peca}
            fixada={fixada}
            aoFixar={aoFixar}
            volumes={volumes}
            ajuste={ajuste}
            aoAjustar={aoAjustar}
          />
        ))}
        {principais.length === 0 && <p className={estilos.vazio}>Você é a primeira pessoa aqui.</p>}
      </div>

      {tira.length > 0 && (
        <div className={estilos.tira}>
          {tira.map((peca) => (
            <Quadro
              key={peca.chave}
              peca={peca}
              fixada={fixada}
              aoFixar={aoFixar}
              volumes={volumes}
              ajuste={ajuste}
              aoAjustar={aoAjustar}
              miniatura
            />
          ))}
        </div>
      )}
    </div>
  )
}
