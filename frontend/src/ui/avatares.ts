// Vermelho fica reservado a parar, sair e erro; avatares usam somente cores de identidade.
const MATIZES = ['--acao', '--atencao', '--conectado', '--turquesa'] as const

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
