import { iniciais, type Palco as EstadoDoPalco, type Peca } from '../../sala/palco'
import { IconeFixar, IconeMicrofoneMudo } from '../../ui/Icone'
import { Video } from './Midia'
import estilos from './Palco.module.css'

interface Props {
  palco: EstadoDoPalco
  /** Chave da tela travada em foco, ou `null` para o arranjo automático. */
  fixada: string | null
  aoFixar(chave: string | null): void
}

function Quadro({
  peca,
  fixada,
  aoFixar,
  miniatura = false,
}: {
  peca: Peca
  fixada: string | null
  aoFixar(chave: string | null): void
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
          <span className={estilos.mudo} title="microfone fechado">
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
export function Palco({ palco, fixada, aoFixar }: Props) {
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
          <Quadro key={peca.chave} peca={peca} fixada={fixada} aoFixar={aoFixar} />
        ))}
        {principais.length === 0 && <p className={estilos.vazio}>Você é a primeira pessoa aqui.</p>}
      </div>

      {tira.length > 0 && (
        <div className={estilos.tira}>
          {tira.map((peca) => (
            <Quadro key={peca.chave} peca={peca} fixada={fixada} aoFixar={aoFixar} miniatura />
          ))}
        </div>
      )}
    </div>
  )
}
