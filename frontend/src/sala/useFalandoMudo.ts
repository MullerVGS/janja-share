import { useEffect, useRef, useState } from 'react'
import { Track, type Room } from 'livekit-client'

/** O aviso fica 2,5 s… */
export const DURACAO_DO_AVISO_MS = 2500
/** …e não volta antes de 2 min. */
export const INTERVALO_ENTRE_AVISOS_MS = 2 * 60 * 1000
/** Nível (RMS de 0 a 1, ~−36 dBFS) a partir do qual uma leitura conta como voz. */
const LIMIAR_DE_FALA = 0.016
const PASSO_MS = 100
/** Fala é a maioria das últimas leituras acima do limiar: uma tosse ou um clique não bastam. */
const JANELA_DE_LEITURAS = 6
const LEITURAS_COM_VOZ = 4

export const FRASE_SILENCIADO = 'Você está silenciado(a)!'

/**
 * "Você está silenciado(a)!" quando a pessoa fala com o microfone fechado. Só vale para quem
 * já abriu o microfone nesta Sala: fechar é mutar a faixa, que segue capturando, e um clone dela
 * — ligado por conta própria, sem ir a lugar nenhum — é o que se escuta aqui. Quem nunca abriu
 * o microfone não é ouvido.
 */
export function useFalandoMudo(sala: Room | null): string | null {
  const [aviso, setAviso] = useState(false)
  const ultimoAviso = useRef(0)
  const publicacao = sala?.localParticipant.getTrackPublication(Track.Source.Microphone)
  const faixa = publicacao?.track?.mediaStreamTrack
  const mudo = Boolean(publicacao?.isMuted)

  useEffect(() => {
    if (!faixa || !mudo || faixa.readyState !== 'live') return
    const Contexto = window.AudioContext
    if (!Contexto) return
    let contexto: AudioContext
    let clone: MediaStreamTrack
    try {
      clone = faixa.clone()
      clone.enabled = true
      contexto = new Contexto()
      void contexto.resume()
    } catch {
      return
    }
    const analisador = contexto.createAnalyser()
    analisador.fftSize = 512
    contexto.createMediaStreamSource(new MediaStream([clone])).connect(analisador)
    const amostras = new Float32Array(analisador.fftSize)
    const ultimas: boolean[] = []
    let some: ReturnType<typeof setTimeout> | undefined

    const relogio = setInterval(() => {
      analisador.getFloatTimeDomainData(amostras)
      let soma = 0
      for (const valor of amostras) soma += valor * valor
      ultimas.push(Math.sqrt(soma / amostras.length) >= LIMIAR_DE_FALA)
      if (ultimas.length > JANELA_DE_LEITURAS) ultimas.shift()
      const agora = Date.now()
      if (ultimas.filter(Boolean).length < LEITURAS_COM_VOZ) return
      if (agora - ultimoAviso.current < INTERVALO_ENTRE_AVISOS_MS) return
      ultimoAviso.current = agora
      setAviso(true)
      clearTimeout(some)
      some = setTimeout(() => setAviso(false), DURACAO_DO_AVISO_MS)
    }, PASSO_MS)

    return () => {
      clearInterval(relogio)
      clearTimeout(some)
      clone.stop()
      void contexto.close()
      setAviso(false)
    }
    // Quem chama re-renderiza a cada evento da Sala e relê a publicação; o relógio é da faixa e
    // do mudo, não de cada render.
  }, [faixa, mudo])

  return aviso && mudo ? FRASE_SILENCIADO : null
}
