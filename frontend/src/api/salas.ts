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

export async function sugerirNomeDeSala(nomeAtual?: string): Promise<string> {
  const busca = nomeAtual ? `?nomeAtual=${encodeURIComponent(nomeAtual)}` : ''
  const sugestao = await pedir<{ nome: string }>(`/api/salas/nome-sugerido${busca}`)
  return sugestao.nome
}

// `nome` continua opcional no contrato porque a ação de compartilhar em um clique pede para o
// backend gerar um. O diálogo, por sua vez, mostra uma sugestão e a envia explicitamente.
export function criarSala({
  nome,
  senha,
  privada,
  seuNome,
}: {
  nome?: string
  senha?: string
  privada?: boolean
  seuNome: string
}): Promise<Credenciais> {
  return enviarJson<Credenciais>('/api/salas', 'POST', { nome, senha, privada, seuNome })
}

export function entrarNaSala(
  slug: string,
  { senha, seuNome }: { senha?: string; seuNome: string },
): Promise<Credenciais> {
  return enviarJson<Credenciais>(`/api/salas/${encodeURIComponent(slug)}/entrar`, 'POST', { senha, seuNome })
}
