import { env } from '../shared/env'
import { LivekitTokenProvider } from '../shared/livekit/livekit-token.provider'
import { assinarLink } from './assinatura'
import { gerarIdentidade } from './identidade'

/** Devolvido por criar sala e por entrar — o front lê `slug` para conectar, `nomeDaSala` para mostrar. */
export interface Credenciais {
  token: string
  urlSfu: string
  slug: string
  nomeDaSala: string
  identidade: string
  nome: string
  privada: boolean
  /** Sala fixa adormece quando todos saem; a efêmera some em 120 s. */
  fixa: boolean
  /**
   * A assinatura do link (`?k=`), emitida a cada entrada para o prazo andar com o encontro.
   * `null` na Sala efêmera — o link dela não traz nada de volta.
   */
  assinatura: string | null
}

export interface SalaParaEntrar {
  nomeNoSfu: string
  slug: string
  nome: string
  privada: boolean
  fixa: boolean
}

/** Uma Pessoa nova na encarnação: identidade sorteada, token no nome com nonce e o link do momento. */
export async function emitirCredenciais(tokens: LivekitTokenProvider, sala: SalaParaEntrar, seuNome: string): Promise<Credenciais> {
  const identidade = gerarIdentidade(seuNome)
  // nomeNoSfu carrega o nonce — é ele, não o slug, que vai no grant do token.
  const token = await tokens.emitir(sala.nomeNoSfu, identidade, seuNome)
  const { livekitUrl } = env()
  return {
    token,
    urlSfu: livekitUrl,
    slug: sala.slug,
    nomeDaSala: sala.nome,
    identidade,
    nome: seuNome,
    privada: sala.privada,
    fixa: sala.fixa,
    assinatura: sala.fixa ? assinarLink({ slug: sala.slug, nome: sala.nome, privada: sala.privada }) : null,
  }
}
