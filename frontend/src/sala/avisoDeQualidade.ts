import { ConnectionQuality } from 'livekit-client'

/**
 * O aviso de qualidade diz de quem é a rede ruim — a minha ou a de quem compartilha —, e só
 * quando há alguém para quem isso importa.
 *
 * A medida é a que o SFU (`ConnectionQuality`) dá a cada um sobre a **própria** conexão. Quem
 * assiste lê a sua e, pelo pulso (`relato.ts`), a que o dono da Tela leu sobre a dele; a medida
 * que o SFU anuncia sobre os outros não serve, porque não mede a rede deles. `Lost` não é aviso
 * de qualidade: é queda, e o quadro já diz isso com o cartão de estado (ADR 0015).
 *
 * Nos primeiros segundos a medida ainda não assentou (conectar e publicar costumam sair como
 * fracos), e um aviso que pisca na entrada ensina a ignorar avisos. Daí o aquecimento: o aviso
 * só vale depois de `AQUECIMENTO_MS` com a Tela no ar.
 */
export const AQUECIMENTO_MS = 10_000

const fraca = (qualidade: ConnectionQuality | undefined) => qualidade === ConnectionQuality.Poor

/** Para quem assiste uma Tela: a minha rede antes, porque é a que eu posso consertar. */
export function avisoParaQuemAssiste(entrada: {
  minha: ConnectionQuality | undefined
  /** O dono pulsou que a rede dele está fraca. */
  donoComRedeFraca: boolean
  nomeDoDono: string
  aquecido: boolean
}): string | null {
  if (!entrada.aquecido) return null
  if (fraca(entrada.minha)) return 'Sua conexão está fraca — a imagem pode travar aqui.'
  if (entrada.donoComRedeFraca) return `A conexão de ${entrada.nomeDoDono} está fraca — a imagem pode travar para todos.`
  return null
}

/** Para quem compartilha: só com alguém assistindo — sem plateia, não há o que travar para ninguém. */
export function avisoParaQuemCompartilha(entrada: {
  minha: ConnectionQuality | undefined
  assistindo: number
  aquecido: boolean
}): string | null {
  if (!entrada.aquecido || entrada.assistindo === 0) return null
  if (fraca(entrada.minha)) return 'Sua conexão está fraca — quem assiste pode ver sua tela travando.'
  return null
}
