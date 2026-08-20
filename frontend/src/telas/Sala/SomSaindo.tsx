import { useEffect, useRef } from 'react'
import estilos from './SomSaindo.module.css'

/** Quantas leituras por segundo do nível: o bastante para a barra acompanhar a voz. */
const LEITURAS_POR_SEGUNDO = 10

/** Sem WebAudio não há nível para mostrar, e um indicador sempre zerado mentiria. */
function temMedidorDeNivel(): boolean {
  return typeof AudioContext !== 'undefined' && typeof MediaStream !== 'undefined'
}

/** A média quadrática das raias, 0–1 — o mesmo cálculo que o `createAudioAnalyser` do SDK faz. */
function nivelDe(raias: Uint8Array): number {
  let soma = 0
  for (const amplitude of raias) soma += (amplitude / 255) ** 2
  return Math.sqrt(soma / raias.length)
}

/**
 * "Está saindo som?" — a única pergunta que o áudio da tela deixa sem resposta, já que quem
 * compartilha não se ouve.
 *
 * O nível vai direto ao elemento por variável CSS: passar por `useState` re-renderizaria a sala
 * inteira dez vezes por segundo para mexer numa barrinha.
 */
export function SomSaindo({ faixa }: { faixa: MediaStreamTrack }) {
  const barra = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const elemento = barra.current
    if (!elemento) return

    const contexto = new AudioContext()
    const analisador = contexto.createAnalyser()
    // Não é espectro, é nível: poucas raias bastam e custam menos por leitura.
    analisador.fftSize = 256
    analisador.smoothingTimeConstant = 0.6
    contexto.createMediaStreamSource(new MediaStream([faixa])).connect(analisador)
    const raias = new Uint8Array(analisador.frequencyBinCount)

    const relogio = setInterval(() => {
      analisador.getByteFrequencyData(raias)
      elemento.style.setProperty('--nivel', nivelDe(raias).toFixed(2))
    }, 1000 / LEITURAS_POR_SEGUNDO)

    return () => {
      clearInterval(relogio)
      void contexto.close()
    }
  }, [faixa])

  if (!temMedidorDeNivel()) return null
  return <span ref={barra} className={estilos.somSaindo} title="som saindo" style={{ ['--nivel' as string]: '0' }} />
}
