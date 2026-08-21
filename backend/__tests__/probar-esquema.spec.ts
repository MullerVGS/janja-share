import { randomBytes } from 'node:crypto'
import { DataSource } from 'typeorm'
import { probarEsquema } from '../src/shared/db/probar-esquema'
import { dataSourceDeTeste } from '../test/banco'

describe('probarEsquema', () => {
  it('sem a tabela no schema (migration não rodou), deixa o erro subir', async () => {
    // `search_path` aponta só para um schema que não existe, sem cair no `public` do Postgres
    // de dev — esse já tem `salas` (migrado por outras specs) e mascararia o próprio teste.
    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      extra: { options: `-c search_path=schema_inexistente_${randomBytes(4).toString('hex')}` },
    })
    await ds.initialize()
    try {
      await expect(probarEsquema(ds)).rejects.toThrow()
    } finally {
      await ds.destroy()
    }
  })

  it('com a migration em dia, resolve — a sonda não é um obstáculo pro boot normal', async () => {
    const ds = await dataSourceDeTeste()
    try {
      await ds.runMigrations()
      await expect(probarEsquema(ds)).resolves.toBeUndefined()
    } finally {
      await ds.destroy()
    }
  })
})
