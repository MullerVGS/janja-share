import { slugDaSala } from '../shared/slug'

/**
 * Nome de sala para quem não quis dar um.
 *
 * Substantivo feminino + adjetivo feminino: concorda com "sala", é legível na lista e fácil de
 * ditar por voz — que é o que um código curto aleatório não é. Devolve o nome de exibição; o
 * slug sai de `slugDaSala` como em qualquer nome digitado.
 */

const SUBSTANTIVOS = [
  'varanda', 'cozinha', 'praia', 'floresta', 'montanha', 'estrada', 'janela', 'fogueira',
  'cachoeira', 'ilha', 'ponte', 'estufa', 'caverna', 'ribeira', 'colina', 'campina',
  'oficina', 'biblioteca', 'garagem', 'sacada', 'trilha', 'lagoa', 'duna', 'clareira',
  'marina', 'tenda', 'cabana', 'esquina', 'alameda', 'enseada',
] as const

const ADJETIVOS = [
  'tranquila', 'barulhenta', 'distante', 'dourada', 'antiga', 'secreta', 'gelada', 'quente',
  'serena', 'perdida', 'brilhante', 'sonora', 'macia', 'veloz', 'profunda', 'clara',
  'sombria', 'alegre', 'severa', 'curiosa', 'teimosa', 'mansa', 'vasta', 'humilde',
  'ligeira', 'discreta', 'valente', 'lenta', 'nobre', 'risonha',
] as const

/** Quantos sorteios antes de desistir do acaso e desempatar por sufixo. */
const TENTATIVAS = 50

function maiuscula(palavra: string): string {
  return palavra.charAt(0).toUpperCase() + palavra.slice(1)
}

function combinar(sortear: () => number): string {
  const substantivo = SUBSTANTIVOS[Math.floor(sortear() * SUBSTANTIVOS.length)] as string
  const adjetivo = ADJETIVOS[Math.floor(sortear() * ADJETIVOS.length)] as string
  return `${maiuscula(substantivo)} ${maiuscula(adjetivo)}`
}

export function gerarNomeDeSala(usados: ReadonlySet<string>, sortear: () => number = Math.random): string {
  for (let i = 0; i < TENTATIVAS; i += 1) {
    const nome = combinar(sortear)
    if (!usados.has(slugDaSala(nome))) return nome
  }
  // O teto do app é 20 salas contra 900 combinações, então chegar aqui significa sorteio
  // travado (teste) ou azar absurdo. O sufixo garante terminação em vez de recursão eterna.
  const base = combinar(sortear)
  for (let n = 2; ; n += 1) {
    const nome = `${base} ${n}`
    if (!usados.has(slugDaSala(nome))) return nome
  }
}

/** Converte o retrato das salas vivas numa sugestão, somando slugs que não podem se repetir. */
export function gerarNomeDeSalaDisponivel(
  salasAtuais: readonly { slug: string }[],
  slugsIgnorados: Iterable<string> = [],
  sortear: () => number = Math.random,
): string {
  const usados = new Set(salasAtuais.map((sala) => sala.slug))
  for (const slug of slugsIgnorados) {
    if (slug !== '') usados.add(slug)
  }
  return gerarNomeDeSala(usados, sortear)
}
