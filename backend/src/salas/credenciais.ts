/** Devolvido por criar sala e por entrar — o front lê `slug` para conectar, `nomeDaSala` para mostrar. */
export interface Credenciais {
  token: string
  urlSfu: string
  slug: string
  nomeDaSala: string
  identidade: string
  nome: string
}
