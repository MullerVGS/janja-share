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

export function env(): Env {
  return {
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
}
