import { lerPreferencias } from '../preferencias'

/**
 * Os sons curtos da sala, sintetizados aqui mesmo com Web Audio — nenhum arquivo de som no
 * projeto. Cada um é uma sequência de notas senoidais curtas com ataque e queda suaves: subir é
 * chegar ou começar, descer é sair ou terminar, e a Tela tem duas notas a mais que a Pessoa.
 */
export type Som = 'telaComecou' | 'telaTerminou' | 'entrou' | 'saiu'

/** Notas de cada som em Hz, na ordem em que tocam. */
export const NOTAS: Record<Som, number[]> = {
  telaComecou: [523.25, 659.25, 783.99],
  telaTerminou: [783.99, 659.25, 523.25],
  entrou: [587.33, 880],
  saiu: [880, 587.33],
}

/** Acima disto, entrada e saída não tocam: numa sala cheia viraria ruído. */
export const LIMITE_DE_PESSOAS_PARA_SONS = 25

export interface FotoDaSala {
  pessoas: string[]
  telas: string[]
}

/**
 * O som de uma mudança, um só por vez, na ordem do que mais importa: alguém começou uma Tela,
 * terminou uma Tela, alguém entrou, alguém saiu. Entrada e saída só com até 25 pessoas.
 */
export function somDaMudanca(antes: FotoDaSala, depois: FotoDaSala): Som | null {
  const novas = (lista: string[], base: string[]) => lista.filter((item) => !base.includes(item)).length
  if (novas(depois.telas, antes.telas) > 0) return 'telaComecou'
  if (novas(antes.telas, depois.telas) > 0) return 'telaTerminou'
  const pequena = Math.max(antes.pessoas.length, depois.pessoas.length) <= LIMITE_DE_PESSOAS_PARA_SONS
  if (pequena && novas(depois.pessoas, antes.pessoas) > 0) return 'entrou'
  if (pequena && novas(antes.pessoas, depois.pessoas) > 0) return 'saiu'
  return null
}

let contexto: AudioContext | null = null

/** O `setSinkId` do Web Audio (Chrome 110+) ainda não está nos tipos do DOM. */
type ContextoComSaida = AudioContext & { setSinkId?: (id: string) => Promise<void> }

/**
 * Os sons da sala saem pelo mesmo aparelho que a Sala. Sem `setSinkId` no Web Audio (Firefox,
 * Safari) eles ficam no padrão do sistema — são bipes curtos, não a conversa.
 */
export function aplicarSaidaAosSons(id: string): void {
  const alvo = contexto as ContextoComSaida | null
  if (!alvo?.setSinkId) return
  alvo.setSinkId(id).catch(() => {
    // O aparelho sumiu: o som segue onde estava.
  })
}

/** Toca o som, se as preferências deixam. Silencioso onde não há Web Audio. */
export function tocar(som: Som): void {
  const { sons, volumeDosSons, saidaDeSom } = lerPreferencias()
  if (!sons || volumeDosSons <= 0) return
  const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Contexto) return
  try {
    if (!contexto) {
      contexto = new Contexto()
      if (saidaDeSom) aplicarSaidaAosSons(saidaDeSom)
    }
    if (contexto.state === 'suspended') void contexto.resume()
    const agora = contexto.currentTime
    const ganhoMaximo = 0.18 * (volumeDosSons / 100)
    NOTAS[som].forEach((frequencia, indice) => {
      const inicio = agora + indice * 0.075
      const oscilador = contexto!.createOscillator()
      const ganho = contexto!.createGain()
      oscilador.type = 'sine'
      oscilador.frequency.value = frequencia
      ganho.gain.setValueAtTime(0, inicio)
      ganho.gain.linearRampToValueAtTime(ganhoMaximo, inicio + 0.012)
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16)
      oscilador.connect(ganho).connect(contexto!.destination)
      oscilador.start(inicio)
      oscilador.stop(inicio + 0.18)
    })
  } catch {
    // Um som que não toca não pode derrubar a sala.
  }
}
