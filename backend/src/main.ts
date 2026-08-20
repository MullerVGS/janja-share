import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { configurarApp } from './bootstrap'

async function main() {
  const app = await NestFactory.create(AppModule)
  configurarApp(app)
  await app.listen(process.env.PORT ?? 3000)
}
// Sem este guard, importar algo deste módulo (não há hoje, mas evita a armadilha) subiria uma
// segunda aplicação de verdade como efeito colateral do import.
if (require.main === module) void main()
