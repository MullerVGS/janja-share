export interface Env {
  databaseUrl: string
  livekitUrl: string
  livekitApiKey: string
  livekitApiSecret: string
  livekitHostInterno: string
  sala: string
  hostAdmin: string
  baseUrlPublica: string
  porta: number
}

function obrigatoria(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`${nome} não definida`)
  return valor
}

let memo: Env | undefined

/**
 * Lê e valida as 8 envs do contrato uma única vez (memoizado), não a cada chamada. Duas
 * razões: performance (eram 8 leituras+validações em toda rota que chamasse env(), inclusive
 * a guarda de admin em todo request) e segurança — validar por request cria um oráculo: se uma
 * env qualquer faltasse, só as rotas que chamam env() dariam 500 enquanto o resto do app
 * seguia respondendo 404 normalmente, e esse 500 denunciaria por exclusão que a rota existe
 * (era exatamente o caso da guarda de admin). Com a validação resolvida uma vez — chamada
 * explícita em configurarApp(), antes do listen() — uma env faltando derruba o processo
 * inteiro no boot; não sobra nenhum estado parcial para sondar.
 */
export function env(): Env {
  memo ??= {
    databaseUrl: obrigatoria('DATABASE_URL'),
    livekitUrl: obrigatoria('LIVEKIT_URL'),
    livekitApiKey: obrigatoria('LIVEKIT_API_KEY'),
    livekitApiSecret: obrigatoria('LIVEKIT_API_SECRET'),
    livekitHostInterno: obrigatoria('LIVEKIT_HOST_INTERNO'),
    sala: process.env.SALA ?? 'share',
    hostAdmin: obrigatoria('HOST_ADMIN'),
    baseUrlPublica: obrigatoria('BASE_URL_PUBLICA'),
    porta: Number(process.env.PORT ?? 3000),
  }
  return memo
}
