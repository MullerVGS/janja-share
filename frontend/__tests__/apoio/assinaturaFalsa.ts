/** Uma assinatura com a forma da do backend: carga `[nome, privada, ate]` em base64url, ponto, MAC. */
export function assinaturaFalsa(nome: string, privada: boolean, ateMs = Date.now() + 86_400_000): string {
  const bytes = new TextEncoder().encode(JSON.stringify([nome, privada ? 1 : 0, Math.floor(ateMs / 1000)]))
  const carga = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${carga}.AAAAAAAAAAAAAAAAAAAAAA`
}
