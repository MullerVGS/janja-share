import { randomBytes } from 'node:crypto'
import { DataSource } from 'typeorm'

/**
 * Um schema Postgres próprio por chamada (não `public`) — dois testes que usassem esta função
 * ao mesmo tempo sobre um schema compartilhado se pisariam. Cada schema nasce e morre isolado;
 * `ds.destroy()` já limpa o schema, então nenhum spec precisa saber disso.
 */
export async function dataSourceDeTeste(schema = `teste_${randomBytes(6).toString('hex')}`): Promise<DataSource> {
  const admin = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL })
  await admin.initialize()
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  await admin.query(`CREATE SCHEMA "${schema}"`)
  await admin.destroy()

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    schema,
    // As migrações são SQL cru sem prefixo de schema; `search_path` na conexão é o que
    // realmente as faz cair no schema isolado em vez de `public`.
    extra: { options: `-c search_path=${schema},public` },
    entities: [__dirname + '/../src/shared/db/entidades/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../src/shared/db/migrations/*{.ts,.js}'],
  })
  await ds.initialize()

  const destruirConexao = ds.destroy.bind(ds)
  ds.destroy = async () => {
    await destruirConexao()
    const admin2 = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL })
    await admin2.initialize()
    await admin2.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin2.destroy()
  }

  return ds
}
