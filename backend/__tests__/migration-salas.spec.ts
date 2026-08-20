import { DataSource } from 'typeorm'
import { dataSourceDeTeste } from '../test/banco'

async function tabelaExiste(ds: DataSource, tabela: string): Promise<boolean> {
  const [{ existe }] = await ds.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1) AS existe`,
    [tabela],
  )
  return existe
}

describe('migration de fundação', () => {
  let ds: DataSource

  beforeAll(async () => {
    ds = await dataSourceDeTeste()
  })

  afterAll(() => ds.destroy())

  it('up cria a tabela salas', async () => {
    await ds.runMigrations()

    expect(await tabelaExiste(ds, 'salas')).toBe(true)
  })

  it('down remove a tabela salas', async () => {
    await ds.undoLastMigration()

    expect(await tabelaExiste(ds, 'salas')).toBe(false)

    // Deixa o schema como as outras specs esperam (migrações em dia) para não vazar estado.
    await ds.runMigrations()
  })
})
