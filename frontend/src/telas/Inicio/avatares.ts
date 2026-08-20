/**
 * Iniciais e cor de quem está numa sala, derivadas só do nome — sem pedir avatar a ninguém.
 *
 * Sem `Math.random`: um avatar que trocasse de cor a cada render tornaria o teste (e a lista)
 * uma loteria. O hash é determinístico de propósito.
 */

const MATIZES = ['--acao', '--atencao', '--perigo', '--turquesa'] as const

export function iniciaisDoNome(nome: string): string {
  const termos = nome.trim().split(/\s+/).filter(Boolean)
  if (termos.length === 0) return '?'
  const primeira = termos[0]!.charAt(0)
  const ultima = termos.length > 1 ? termos[termos.length - 1]!.charAt(0) : ''
  return (primeira + ultima).toUpperCase()
}

export function corDoNome(nome: string): string {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) | 0
  const indice = Math.abs(hash) % MATIZES.length
  return `var(${MATIZES[indice]})`
}
