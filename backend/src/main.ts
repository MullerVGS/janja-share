import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from './app.module'
import { configurarApp } from './bootstrap'
import { probarEsquema } from './shared/db/probar-esquema'

async function main() {
  const app = await NestFactory.create(AppModule)
  configurarApp(app)
  // Falha antes do listen() quando o schema ainda não foi migrado.
  await probarEsquema(app.get(DataSource))
  await app.listen(process.env.PORT ?? 3000)
}
// Sem este guard, importar algo deste módulo (não há hoje, mas evita a armadilha) subiria uma
// segunda aplicação de verdade como efeito colateral do import.
if (require.main === module) void main()
