import { INestApplication, ValidationPipe } from '@nestjs/common'
import { env } from './shared/env'
import { ErroApiFilter, ErroInternoFilter } from './shared/erros'
import { montarSpa } from './shared/http/spa'

/**
 * Montagem única da aplicação, usada tanto por main.ts (produção) quanto por test/helpers.ts
 * (e2e) — para o e2e exercitar exatamente a mesma aplicação que roda em produção, e não uma
 * versão paralela que diverge sem que nenhum teste perceba (foi assim que a fronteira SPA×API
 * ficou sem cobertura da primeira vez: o helper de teste não montava o SPA).
 *
 * `dirPublico` existe só para teste montar um bundle fixo num diretório temporário — em
 * produção e no dia a dia dos outros testes, omitir usa o padrão (`dirPublicoPadrao()`).
 */
export function configurarApp(app: INestApplication, dirPublico?: string): void {
  env() // valida as 5 envs do contrato uma vez, aqui — falha rápido no boot (ver env.ts)
  app.setGlobalPrefix('api')
  // TLS termina na borda (reverse proxy/reverse proxy); sem isto o Express não sabe que a requisição
  // chegou por HTTPS pelo X-Forwarded-Proto. O mesmo número também decide o que `req.ip`
  // devolve (ver shared/ip.ts) — atrás de reverse proxy e reverse proxy podem ser dois saltos, não um; o
  // valor certo se confirma na VPS (ticket de deploy), não aqui.
  app.getHttpAdapter().getInstance().set('trust proxy', 1)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Ordem importa (ver comentário de ErroInternoFilter em erros.ts): o Nest resolve o ÚLTIMO
  // filtro global compatível, então o específico (ErroApiFilter) vem depois do fallback.
  app.useGlobalFilters(new ErroInternoFilter(), new ErroApiFilter())
  // Antes do listen()/init(): monta os middlewares do SPA à frente das rotas do Nest.
  montarSpa(app, dirPublico)
}
