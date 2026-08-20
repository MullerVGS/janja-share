import { iniciais, type Palco as EstadoDoPalco, type Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { VOLUME_CHEIO, type TipoDeAudio } from '../../sala/volumes'
import { IconeFixar, IconeMicrofoneMudo, IconeSom, IconeSomMudo } from '../../ui/Icone'
import { Video } from './Midia'
import estilos from './Palco.module.css'

interface Props {
  palco: EstadoDoPalco
  /** Chave da tela travada em foco, ou `null` para o arranjo automático. */
  fixada: string | null
  aoFixar(chave: string | null): void
  volumes: ControleDeVolumes
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
  miniatura = false,
}: {
  peca: Peca
  fixada: string | null
  aoFixar(chave: string | null): void
  volumes: ControleDeVolumes
  miniatura?: boolean
}) {
  const estaFixada = fixada === peca.chave

  return (
    <div
      className={[estilos.quadro, miniatura ? estilos.miniatura : '', peca.falando ? estilos.falando : '']
        .filter(Boolean)
        .join(' ')}
      data-tela={peca.ehTela || undefined}
    >
      {peca.publicacao ? (
        <Video publicacao={peca.publicacao} className={estilos.video} espelhar={peca.proprio && !peca.ehTela} />
      ) : (
        <div className={estilos.semVideo}>
          <span className={estilos.iniciais}>{iniciais(peca.nome)}</span>
        </div>
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
      </div>

      {peca.ehTela && (
        <button
          type="button"
          className={estilos.fixar}
          aria-pressed={estaFixada}
          title={estaFixada ? 'soltar do foco' : 'fixar em foco'}
          onClick={() => aoFixar(estaFixada ? null : peca.chave)}
        >
          <IconeFixar tamanho={15} />
        </button>
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
export function Palco({ palco, fixada, aoFixar, volumes }: Props) {
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
          <Quadro key={peca.chave} peca={peca} fixada={fixada} aoFixar={aoFixar} volumes={volumes} />
        ))}
        {principais.length === 0 && <p className={estilos.vazio}>Você é a primeira pessoa aqui.</p>}
      </div>

      {tira.length > 0 && (
        <div className={estilos.tira}>
          {tira.map((peca) => (
            <Quadro key={peca.chave} peca={peca} fixada={fixada} aoFixar={aoFixar} volumes={volumes} miniatura />
          ))}
        </div>
      )}
    </div>
  )
}
