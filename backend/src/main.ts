import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ErroApiFilter, ErroInternoFilter } from './shared/erros'
import { montarSpa } from './shared/http/spa'

async function main() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  // TLS termina na borda (reverse proxy/reverse proxy); sem isto o Express não sabe que a requisição
  // chegou por HTTPS pelo X-Forwarded-Proto.
  app.getHttpAdapter().getInstance().set('trust proxy', 1)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Ordem importa (ver comentário de ErroInternoFilter em erros.ts): o Nest resolve o ÚLTIMO
  // filtro global compatível, então o específico (ErroApiFilter) vem depois do fallback.
  app.useGlobalFilters(new ErroInternoFilter(), new ErroApiFilter())
  // Antes do listen(): monta os middlewares do SPA à frente das rotas do Nest, que só entram
  // no Express durante o init() disparado pelo listen().
  montarSpa(app)
  await app.listen(process.env.PORT ?? 3000)
}
// Sem este guard, importar algo deste módulo (não há hoje, mas evita a armadilha) subiria uma
// segunda aplicação de verdade como efeito colateral do import.
if (require.main === module) void main()
