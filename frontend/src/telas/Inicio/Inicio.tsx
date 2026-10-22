import { useState } from 'react'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useSalasNoAr } from '../../salas/useSalasNoAr'
import { Casca } from '../Casca/Casca'
import { PainelDaPessoa } from '../Casca/PainelDaPessoa'
import { DISCLAIMER, Saguao } from './Saguao'
import estilos from './Inicio.module.css'

/**
 * O saguão na casca: a coluna mostra as Salas no ar, o trilho "Suas salas", e a página dá as
 * boas-vindas com o criar. No celular o saguão é a lista, e o disclaimer desce para o pé dela.
 */
export function Inicio() {
  const [meuNome, setMeuNome] = useState(() => lerPreferencias().nome)
  const lista = useSalasNoAr()

  function definirNome(nome: string) {
    setMeuNome(nome)
    gravarPreferencias({ nome })
  }

  return (
    <Casca
      salaAtual={null}
      noSaguao
      aoIrAoSaguao={() => {}}
      vistaNoCelular="lista"
      rodapeDaColuna={<p className={estilos.disclaimerNaLista}>{DISCLAIMER}</p>}
      paineis={
        <PainelDaPessoa nome={meuNome} aoMudarNome={definirNome} estado="No saguão" microfone={null} surdo={null} />
      }
      pagina={({ criarSala }) => <Saguao noAr={lista.data} aoCriar={criarSala} />}
    />
  )
}
