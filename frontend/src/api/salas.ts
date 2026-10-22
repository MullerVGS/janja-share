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
  /**
   * Os três abaixo chegam desde a Sala fixa (ADR 0013). Opcionais porque uma sessão guardada
   * antes dela não os tem — e ausência é a Sala pública e efêmera de antes.
   */
  privada?: boolean
  /** Fixa adormece quando todos saem e volta pelo link; a efêmera some. */
  fixa?: boolean
  /** O `?k=` do link da Sala fixa, renovado a cada entrada. `null` na efêmera. */
  assinatura?: string | null
}

/** Resposta de `PATCH /api/salas/:slug`: o que a Sala passou a ser. */
export interface SalaAjustada {
  slug: string
  nomeDaSala: string
  privada: boolean
  fixa: boolean
  assinatura: string | null
}

/** Item de `GET /api/salas`. Sala vazia em carência aparece aqui — é o que explica o nome ocupado. */
export interface SalaNaLista {
  slug: string
  nome: string
  pessoas: string[]
  telasNoAr: number
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
// `fixa` ausente é fixa — o padrão; só `false` pede a Sala efêmera.
export function criarSala({
  nome,
  privada,
  fixa,
  seuNome,
}: {
  nome?: string
  privada?: boolean
  fixa?: boolean
  seuNome: string
}): Promise<Credenciais> {
  return enviarJson<Credenciais>('/api/salas', 'POST', { nome, privada, fixa, seuNome })
}

/** A `assinatura` é o `?k=` do link: só pesa quando a Sala não está mais no SFU. */
export function entrarNaSala(
  slug: string,
  { seuNome, assinatura }: { seuNome: string; assinatura?: string },
): Promise<Credenciais> {
  return enviarJson<Credenciais>(`/api/salas/${encodeURIComponent(slug)}/entrar`, 'POST', { seuNome, assinatura })
}

/** Nome e visibilidade, por quem está na Sala: o token do LiveKit é a prova de presença. */
export function ajustarSala(
  slug: string,
  ajuste: { nome?: string; privada?: boolean },
  token: string,
): Promise<SalaAjustada> {
  return enviarJson<SalaAjustada>(`/api/salas/${encodeURIComponent(slug)}`, 'PATCH', ajuste, {
    authorization: `Bearer ${token}`,
  })
}
