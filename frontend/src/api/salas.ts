import { enviarJson, pedir } from './cliente'

/** `nome` (da sala) e `seuNome` (da pessoa): 1 a 40 caracteres, pelo contrato. */
export const LIMITE_DO_NOME = 40

/** Resposta de `POST /api/salas` e `POST /api/salas/:slug/entrar`: tudo que a sala precisa para conectar. */
export interface Credenciais {
  token: string
  urlSfu: string
  slug: string
  nomeDaSala: string
  identidade: string
  nome: string
}

/** Item de `GET /api/salas`. Sala vazia em carência aparece aqui — é o que explica o nome ocupado. */
export interface SalaNaLista {
  slug: string
  nome: string
  pessoas: string[]
  telasNoAr: number
  temSenha: boolean
  cheia: boolean
}

export function listarSalas(): Promise<SalaNaLista[]> {
  return pedir<SalaNaLista[]>('/api/salas')
}

export function criarSala({ nome, senha, seuNome }: { nome: string; senha?: string; seuNome: string }): Promise<Credenciais> {
  return enviarJson<Credenciais>('/api/salas', 'POST', { nome, senha, seuNome })
}

export function entrarNaSala(
  slug: string,
  { senha, seuNome }: { senha?: string; seuNome: string },
): Promise<Credenciais> {
  return enviarJson<Credenciais>(`/api/salas/${encodeURIComponent(slug)}/entrar`, 'POST', { senha, seuNome })
}
