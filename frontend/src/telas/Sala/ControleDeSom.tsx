import type { Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { VOLUME_CHEIO, type TipoDeAudio } from '../../sala/volumes'
import { IconeMicrofone, IconeMicrofoneMudo, IconeSom, IconeSomMudo } from '../../ui/Icone'
import { SomSaindo } from './SomSaindo'
import estilos from './ControleDeSom.module.css'

interface Props {
  peca: Peca
  volumes: ControleDeVolumes
}

/**
 * O volume daquele quadro, só neste navegador — a voz de quem fala, se a peça é de pessoa; o
 * som que a tela publica, se é de tela.
 *
 * As duas fontes têm o mesmo controle no mesmo lugar: a etiqueta, sempre à vista. O volume já
 * morou numa pílula que só aparecia no hover, e ninguém o achava — esconder o controle apaga o
 * aviso bem na hora em que ele importa. Esse é o defeito que motivou este componente.
 *
 * Com o microfone fechado o controle de voz não some: sumir confundiria "não há nada a calar
 * agora" com "esta pessoa nunca teve microfone", e a segunda pergunta continua tendo resposta.
 */
export function ControleDeSom({ peca, volumes }: Props) {
  const tipo: TipoDeAudio = peca.ehTela ? 'tela' : 'pessoa'
  const alvo = peca.ehTela ? `o som da tela de ${peca.nome}` : `a voz de ${peca.nome}`
  const alvoDoVolume = peca.ehTela ? `do som da tela de ${peca.nome}` : `da voz de ${peca.nome}`
  const volume = volumes.volumeDe(peca.nome, tipo)
  const mudo = volume === 0
  const microfoneFechado = !peca.ehTela && !peca.microfoneLigado
  const rotulo = `${mudo ? 'Devolver' : 'Calar'} ${alvo}`
  const dica = microfoneFechado ? 'microfone fechado' : rotulo

  const IconeLigado = peca.ehTela ? IconeSom : IconeMicrofone
  const IconeDesligado = peca.ehTela ? IconeSomMudo : IconeMicrofoneMudo
  const faixaDoSom = peca.ehTela ? peca.publicacaoDoAudio?.track?.mediaStreamTrack : undefined

  return (
    <div className={estilos.controle}>
      <button
        type="button"
        className={estilos.acao}
        aria-pressed={mudo}
        aria-label={rotulo}
        title={dica}
        disabled={microfoneFechado}
        onClick={() => volumes.alternarMudo(peca.nome, tipo)}
      >
        {mudo ? <IconeDesligado tamanho={15} /> : <IconeLigado tamanho={15} />}
      </button>
      <input
        type="range"
        className={estilos.faixaDoVolume}
        min={0}
        max={VOLUME_CHEIO}
        step={1}
        value={volume}
        aria-label={`Volume ${alvoDoVolume}`}
        title={dica}
        disabled={microfoneFechado}
        onChange={(evento) => volumes.definir(peca.nome, tipo, Number(evento.target.value))}
      />
      {faixaDoSom && <SomSaindo faixa={faixaDoSom} />}
    </div>
  )
}
