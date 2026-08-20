/**
 * Volume local: quanto cada pessoa e cada tela tocam **neste** navegador.
 *
 * É ajuste de quem ouve, não de quem fala — nada disso sai para a sala. Duas fontes de som
 * chegam de cada participante e elas não se confundem: a voz (microfone) e o som da tela que
 * ele compartilha. Baixar o jogo alheio sem perder a conversa é o caso que dá razão ao módulo.
 *
 * A chave é o **nome**, não a identidade: a identidade nasce nova a cada entrada, e quem
 * abaixou o volume do Caio ontem quer o Caio baixo hoje. Os mapas são tratados como
 * imutáveis — quem muda devolve outro.
 */

export type TipoDeAudio = 'pessoa' | 'tela'

/** Volume 0–100 por tipo de áudio daquele nome. Ausente = ninguém mexeu, toca inteiro. */
export type VolumePorNome = Partial<Record<TipoDeAudio, number>>
export type Volumes = Record<string, VolumePorNome>

export const VOLUME_CHEIO = 100

const TIPOS: readonly TipoDeAudio[] = ['pessoa', 'tela']

/** A mesma normalização que a etiqueta do quadro faz — as duas precisam falar do mesmo alguém. */
function chave(nome: string): string {
  return nome.trim()
}

export function volumeDe(volumes: Volumes, nome: string, tipo: TipoDeAudio): number {
  return volumes[chave(nome)]?.[tipo] ?? VOLUME_CHEIO
}

export function comVolume(volumes: Volumes, nome: string, tipo: TipoDeAudio, volume: number): Volumes {
  const nomeLimpo = chave(nome)
  const limitado = Math.max(0, Math.min(VOLUME_CHEIO, Math.round(volume)))
  return { ...volumes, [nomeLimpo]: { ...volumes[nomeLimpo], [tipo]: limitado } }
}

/**
 * O que estava no disco vira mapa entrada a entrada: um nome estragado some sozinho e os
 * outros continuam valendo. Descartar o mapa inteiro por causa de um valor esquisito custaria
 * a todos os volumes ajustados ao longo de meses.
 */
export function lerVolumes(valor: unknown): Volumes | undefined {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return undefined

  const limpo: Volumes = {}
  for (const [nome, bruto] of Object.entries(valor as Record<string, unknown>)) {
    if (bruto === null || typeof bruto !== 'object') continue
    const entrada: VolumePorNome = {}
    for (const tipo of TIPOS) {
      const volume = (bruto as Record<string, unknown>)[tipo]
      if (typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= VOLUME_CHEIO) {
        entrada[tipo] = volume
      }
    }
    if (Object.keys(entrada).length > 0) limpo[chave(nome)] = entrada
  }
  return limpo
}
