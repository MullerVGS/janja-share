/**
 * As iniciais que representam alguém sem foto — no avatar da lista, na faixa do palco e no
 * círculo grande de quem está sem câmera. Uma regra só para os três: duas letras sempre que o
 * nome der, porque uma letra sozinha confunde metade da sala numa lista de dez pessoas.
 */
export function iniciaisDoNome(nome: string): string {
  const termos = nome.trim().split(/\s+/).filter(Boolean)
  if (termos.length === 0) return '?'
  const primeiro = termos[0]!
  if (termos.length === 1) return primeiro.slice(0, 2).toUpperCase()
  return (primeiro.charAt(0) + termos[termos.length - 1]!.charAt(0)).toUpperCase()
}
