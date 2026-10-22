import { useRef, useState } from 'react'
import { LIMITE_DO_NOME } from '../../api/salas'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { Avatar } from '../../ui/Avatar'
import { IconeFones, IconeMicrofone, IconeMicrofoneMudo, IconePreferencias } from '../../ui/Icone'
import { Suspenso } from '../../ui/Suspenso'
import estilos from './PainelDaPessoa.module.css'

/** O microfone desta pessoa na Sala; `null` fora de uma Sala. */
export interface MicrofoneDoPainel {
  ligado: boolean
  ocupado: boolean
  alternar(): void
  /** O aviso de quem fala com o microfone fechado, ou `null`. */
  aviso: string | null
}

/** Ensurdecer: cala o som da Sala para esta pessoa (e fecha o microfone junto). */
export interface SurdoDoPainel {
  ligado: boolean
  alternar(): void
}

interface Props {
  nome: string
  aoMudarNome(nome: string): void
  /** O que aparece embaixo do nome: onde a pessoa está. */
  estado: string
  microfone: MicrofoneDoPainel | null
  surdo: SurdoDoPainel | null
}

/**
 * O rodapé da coluna: quem você é e os três botões de sempre — microfone, ensurdecer e
 * preferências. As preferências moram num suspenso: o nome com que os outros te veem e os sons
 * curtos da sala (ligar, desligar e volume).
 *
 * Fora de uma Sala o microfone e o ensurdecer ficam apagados, dizendo por quê: não há som a
 * calar nem a quem mandar a voz.
 */
export function PainelDaPessoa({ nome, aoMudarNome, estado, microfone, surdo }: Props) {
  const [aberto, setAberto] = useState(false)
  const botaoDasPreferencias = useRef<HTMLButtonElement>(null)
  const [sons, setSons] = useState(() => {
    const { sons: ligados, volumeDosSons } = lerPreferencias()
    return { ligados, volume: volumeDosSons }
  })
  const semNome = nome.trim() === ''
  const foraDaSala = 'Entre numa sala para usar'

  function mudarSons(novos: { ligados: boolean; volume: number }) {
    setSons(novos)
    gravarPreferencias({ sons: novos.ligados, volumeDosSons: novos.volume })
  }

  return (
    <div className={estilos.painel}>
      <button
        type="button"
        className={estilos.quem}
        aria-label="Seu perfil e preferências"
        onClick={() => setAberto((valor) => !valor)}
      >
        <span className={estilos.avatar}>
          <Avatar nome={semNome ? '?' : nome} tamanho={32} />
          <span className={estilos.pontoDeEstado} data-em-sala={microfone ? '' : undefined} aria-hidden="true" />
        </span>
        <span className={estilos.textos}>
          <span className={estilos.nome}>{semNome ? 'Sem nome' : nome}</span>
          <span className={estilos.estado}>{estado}</span>
        </span>
      </button>

      <div className={estilos.botoes}>
        <span className={estilos.ancoraDoAviso}>
          <button
            type="button"
            className={estilos.botao}
            data-fechado={microfone && !microfone.ligado ? '' : undefined}
            aria-pressed={microfone ? microfone.ligado : undefined}
            aria-label={microfone ? (microfone.ligado ? 'Fechar microfone' : 'Abrir microfone') : 'Microfone'}
            title={microfone ? `${microfone.ligado ? 'Fechar' : 'Abrir'} microfone (M)` : foraDaSala}
            disabled={!microfone || microfone.ocupado}
            onClick={microfone?.alternar}
          >
            {microfone?.ligado ? <IconeMicrofone tamanho={20} /> : <IconeMicrofoneMudo tamanho={20} />}
          </button>
          {microfone?.aviso && (
            <span className={estilos.aviso} role="status">
              {microfone.aviso}
            </span>
          )}
        </span>
        <button
          type="button"
          className={estilos.botao}
          data-fechado={surdo?.ligado ? '' : undefined}
          data-riscado={surdo?.ligado ? '' : undefined}
          aria-pressed={surdo ? surdo.ligado : undefined}
          aria-label={surdo?.ligado ? 'Voltar a ouvir a sala' : 'Ensurdecer'}
          title={surdo ? (surdo.ligado ? 'Voltar a ouvir a sala' : 'Ensurdecer: calar o som da sala') : foraDaSala}
          disabled={!surdo}
          onClick={surdo?.alternar}
        >
          <IconeFones tamanho={20} />
        </button>
        <button
          ref={botaoDasPreferencias}
          type="button"
          className={estilos.botao}
          aria-expanded={aberto}
          aria-label="Preferências"
          title="Preferências"
          onClick={() => setAberto((valor) => !valor)}
        >
          <IconePreferencias tamanho={20} />
        </button>
      </div>

      <Suspenso
        ancora={botaoDasPreferencias}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        rotulo="Preferências"
        papel="group"
      >
        <div className={estilos.preferencias}>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Seu nome</span>
            <input
              className={estilos.entrada}
              placeholder="como os outros vão te ver"
              maxLength={LIMITE_DO_NOME}
              value={nome}
              onChange={(evento) => aoMudarNome(evento.target.value)}
            />
          </label>
          <label className={estilos.alternar}>
            <input
              type="checkbox"
              checked={sons.ligados}
              onChange={(evento) => mudarSons({ ...sons, ligados: evento.target.checked })}
            />
            <span>Sons da sala</span>
          </label>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Volume dos sons</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sons.volume}
              disabled={!sons.ligados}
              onChange={(evento) => mudarSons({ ...sons, volume: Number(evento.target.value) })}
            />
          </label>
          <p className={estilos.nota}>Alguém entrar ou sair, e uma tela começar ou parar.</p>
        </div>
      </Suspenso>
    </div>
  )
}
