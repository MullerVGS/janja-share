import { enviarJson, pedir } from './cliente'

/** `GET /api/convites/:token` — só o caminho de sucesso; os demais chegam como `ErroDaApi`. */
export interface PrechecagemDeConvite {
  valido: boolean
  rotulo: string
}

/** Resposta de `POST /api/entrar`: tudo que a sala precisa para conectar. */
export interface Credenciais {
  token: string
  urlSfu: string
  sala: string
  identidade: string
  nome: string
}

/** Item de `GET /api/admin/convites`. */
export interface Convite {
  id: string
  rotulo: string
  criadoEm: string
  expiraEm: string
  usosMax: number | null
  usos: number
  revogadoEm: string | null
  ativo: boolean
}

/** Resposta de `POST /api/admin/convites` — o `link` só existe nesta resposta. */
export interface ConviteCriado {
  id: string
  rotulo: string
  link: string
}

export interface NovoConvite {
  rotulo: string
  validadeHoras: number
  usosMax: number | null
}

export function precheckarConvite(token: string): Promise<PrechecagemDeConvite> {
  return pedir<PrechecagemDeConvite>(`/api/convites/${encodeURIComponent(token)}`)
}

export function entrar(convite: string, nome: string): Promise<Credenciais> {
  return enviarJson<Credenciais>('/api/entrar', 'POST', { convite, nome })
}

export function listarConvites(): Promise<Convite[]> {
  return pedir<Convite[]>('/api/admin/convites')
}

export function criarConvite(novo: NovoConvite): Promise<ConviteCriado> {
  return enviarJson<ConviteCriado>('/api/admin/convites', 'POST', novo)
}

export function revogarConvite(id: string): Promise<void> {
  return enviarJson<void>(`/api/admin/convites/${encodeURIComponent(id)}`, 'DELETE')
}
