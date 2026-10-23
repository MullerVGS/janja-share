import { useEffect, useState } from 'react'
import { dispositivosDoTipo, listarDispositivos, type Dispositivo } from './dispositivos'

export interface ListaDeDispositivos {
  microfones: Dispositivo[]
  saidas: Dispositivo[]
  /** O navegador escondeu os nomes: a permissão do microfone ainda não foi dada. */
  semNomes: boolean
}

const VAZIA: ListaDeDispositivos = { microfones: [], saidas: [], semNomes: false }

/**
 * Os aparelhos de som deste computador, relidos a cada vez que a lista é mostrada e quando um
 * fone entra ou sai. Reler ao abrir é o que traz os nomes depois que a pessoa libera o
 * microfone: dar a permissão não dispara `devicechange` em todo navegador.
 */
export function useDispositivos(mostrando: boolean): ListaDeDispositivos {
  const [lista, setLista] = useState(VAZIA)

  useEffect(() => {
    if (!mostrando) return
    let vivo = true
    const reler = () => {
      void listarDispositivos().then((todos) => {
        if (!vivo) return
        const audio = todos.filter((item) => item.kind === 'audioinput' || item.kind === 'audiooutput')
        setLista({
          microfones: dispositivosDoTipo(todos, 'microfone'),
          saidas: dispositivosDoTipo(todos, 'saida'),
          semNomes: audio.length > 0 && audio.every((item) => item.label === ''),
        })
      })
    }
    reler()
    navigator.mediaDevices?.addEventListener?.('devicechange', reler)
    return () => {
      vivo = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', reler)
    }
  }, [mostrando])

  return lista
}
