/**
 * As iniciais que representam alguém sem foto — no avatar da lista e na faixa do palco. Uma
 * regra só para os dois: duas letras sempre que o nome der, porque uma letra sozinha confunde
 * metade da sala numa lista de dez pessoas.
 */
export function iniciaisDoNome(nome: string): string {
  const termos = nome.trim().split(/\s+/).filter(Boolean)
  if (termos.length === 0) return '?'
  const primeiro = termos[0]!
  if (termos.length === 1) return primeiro.slice(0, 2).toUpperCase()
  return (primeiro.charAt(0) + termos[termos.length - 1]!.charAt(0)).toUpperCase()
}

/**
 * As seis cores de avatar. Quem não tem foto ganha uma delas pelo nome — sempre a mesma para o
 * mesmo nome, em qualquer lugar da sala —, e é a cor que separa duas pessoas de iniciais iguais
 * de relance, na coluna, na grade e no chat.
 */
export const CORES_DE_AVATAR = ['#6c60dc', '#6d6f78', '#2f9e5f', '#d4911c', '#d0434b', '#d74e9a'] as const

export function corDoNome(nome: string): string {
  let soma = 0
  for (const letra of nome.trim().toLocaleLowerCase('pt-BR')) soma = (soma * 31 + letra.codePointAt(0)!) >>> 0
  return CORES_DE_AVATAR[soma % CORES_DE_AVATAR.length]!
}
