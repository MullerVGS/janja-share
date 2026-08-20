import { DataSource } from 'typeorm'
import { Convite } from '../src/shared/db/entidades/convite.entity'
import { ConvitesRepository } from '../src/convites/repositories/convites.repository'
import { dataSourceDeTeste } from '../test/banco'

describe('ConvitesRepository — consumirUso', () => {
  let ds: DataSource
  let convites: ConvitesRepository

  beforeAll(async () => {
    ds = await dataSourceDeTeste()
    await ds.runMigrations()
    convites = new ConvitesRepository(ds.getRepository(Convite))
  })

  afterAll(() => ds.destroy())

  it('buscarPorHash de um hash inexistente devolve null', async () => {
    await expect(convites.buscarPorHash('0'.repeat(64))).resolves.toBeNull()
  })

  it('consumirUso incrementa e devolve a linha quando a condição vale', async () => {
    const hash = ConvitesRepository.hash(ConvitesRepository.gerarToken())
    await convites.criar('Teste', new Date(Date.now() + 3600_000), 3, hash)

    const primeiro = await convites.consumirUso(hash)
    expect(primeiro).not.toBeNull()

    const convite = await convites.buscarPorHash(hash)
    expect(convite!.usos).toBe(1)
  })

  it('a invariante usos <= usosMax é do banco: dois UPDATEs concorrentes num convite de 1 uso — só um entra', async () => {
    const hash = ConvitesRepository.hash(ConvitesRepository.gerarToken())
    await convites.criar('Teste', new Date(Date.now() + 3600_000), 1, hash)

    const [a, b] = await Promise.all([convites.consumirUso(hash), convites.consumirUso(hash)])
    const sucessos = [a, b].filter((r) => r !== null)
    expect(sucessos).toHaveLength(1)

    const convite = await convites.buscarPorHash(hash)
    expect(convite!.usos).toBe(1)
  })

  it('consumirUso não incrementa um convite já revogado', async () => {
    const hash = ConvitesRepository.hash(ConvitesRepository.gerarToken())
    const convite = await convites.criar('Teste', new Date(Date.now() + 3600_000), null, hash)
    await ds.getRepository(Convite).update(convite.id, { revogadoEm: new Date() })

    await expect(convites.consumirUso(hash)).resolves.toBeNull()
  })
})
