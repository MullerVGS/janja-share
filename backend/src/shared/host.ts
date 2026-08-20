/** Compara o Host da requisição com HOST_ADMIN ignorando porta e caixa (guarda de /api/admin/*). */
export function hostBate(hostRequisicao: string | undefined, hostAdmin: string): boolean {
  if (!hostRequisicao) return false
  const semPorta = (h: string) => h.split(':')[0].toLowerCase()
  return semPorta(hostRequisicao) === semPorta(hostAdmin)
}
