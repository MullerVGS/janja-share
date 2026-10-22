import { useEffect, useRef } from 'react'
import type { Palco } from './palco'
import { somDaMudanca, tocar, type FotoDaSala } from './sons'

function fotoDo(palco: Palco): FotoDaSala {
  return {
    pessoas: palco.pessoas.map((pessoa) => pessoa.identidade),
    telas: palco.telas.filter((tela) => !tela.encerrada).map((tela) => tela.identidade),
  }
}

/**
 * Toca o som de cada mudança da Sala — um por mudança, pela ordem de `somDaMudanca`. A primeira
 * foto, ao conectar, não toca nada: chegar numa sala cheia não é "todo mundo entrou".
 */
export function useSonsDaSala(palco: Palco, conectada: boolean): void {
  const anterior = useRef<FotoDaSala | null>(null)
  const foto = fotoDo(palco)
  const chave = `${foto.pessoas.join(',')}|${foto.telas.join(',')}`

  useEffect(() => {
    if (!conectada) {
      anterior.current = null
      return
    }
    const antes = anterior.current
    anterior.current = foto
    if (!antes) return
    const som = somDaMudanca(antes, foto)
    if (som) tocar(som)
    // A chave resume a foto; a foto em si muda de identidade a cada render.
  }, [chave, conectada])
}
