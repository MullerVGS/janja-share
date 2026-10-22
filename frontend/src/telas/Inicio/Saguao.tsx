import { Botao } from '../../ui/Botao'
import { IconeMais, IconeMarca, IconeSaguao } from '../../ui/Icone'
import { SuasSalas } from './SuasSalas'
import type { SalaNaLista } from '../../api/salas'
import estilos from './Saguao.module.css'

/** O rodapé do saguão: a piada do esforço, sem citar ninguém. */
export const DISCLAIMER = 'Qualquer semelhança é mera coincidência.'

interface Props {
  noAr: SalaNaLista[] | undefined
  aoCriar(): void
}

/**
 * A página do saguão: as boas-vindas com a ação de criar uma Sala, "Suas salas" com a lista
 * detalhada (entrar e tirar da lista) e o disclaimer no rodapé. As Salas no ar moram na coluna,
 * como canais de voz — aqui não se repetem.
 */
export function Saguao({ noAr, aoCriar }: Props) {
  return (
    <div className={estilos.saguao}>
      <header className={estilos.cabecalho}>
        <span className={estilos.icone} aria-hidden="true">
          <IconeSaguao tamanho={20} />
        </span>
        <h1 className={estilos.titulo}>Saguão</h1>
      </header>

      <div className={estilos.rolagem}>
        <section className={estilos.boasVindas}>
          <span className={estilos.marca} aria-hidden="true">
            <IconeMarca tamanho={40} />
          </span>
          <h2 className={estilos.ola}>Boas-vindas ao janja-share</h2>
          <p className={estilos.descricao}>
            Abra uma sala, chame quem quiser e compartilhe a tela em poucos segundos. Quando todo mundo sair, ela
            fica guardada por 7 dias, e a turma volta pelo mesmo link. As salas no ar estão na coluna ao lado.
          </p>
          <Botao aparencia="primario" onClick={aoCriar}>
            <IconeMais tamanho={16} />
            Criar sala
          </Botao>
        </section>

        <SuasSalas noAr={noAr} />
      </div>

      <footer className={estilos.rodape}>{DISCLAIMER}</footer>
    </div>
  )
}
