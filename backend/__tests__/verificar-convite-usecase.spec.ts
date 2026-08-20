import { DataSource } from 'typeorm'
import { Convite } from '../src/shared/db/entidades/convite.entity'
import { ConvitesRepository } from '../src/convites/repositories/convites.repository'
import { VerificarConviteUseCase } from '../src/convites/useCases/verificarConvite/VerificarConviteUseCase'
import { ConviteEsgotado, ConviteExpirado, ConviteInvalido, ConviteRevogado } from '../src/shared/erros'
import { dataSourceDeTeste } from '../test/banco'

describe('VerificarConviteUseCase — pré-checagem (não consome uso)', () => {
  let ds: DataSource
  let convites: ConvitesRepository
  let verificar: VerificarConviteUseCase

  beforeAll(async () => {
    ds = await dataSourceDeTeste()
    await ds.runMigrations()
    convites = new ConvitesRepository(ds.getRepository(Convite))
    verificar = new VerificarConviteUseCase(convites)
  })

  afterAll(() => ds.destroy())

  async function criarConvite(
    overrides: { rotulo?: string; expiraEm?: Date; usosMax?: number | null; usos?: number; revogadoEm?: Date | null } = {},
  ): Promise<string> {
    const token = ConvitesRepository.gerarToken()
    const hash = ConvitesRepository.hash(token)
    const convite = await convites.criar(overrides.rotulo ?? 'Rótulo', overrides.expiraEm ?? new Date(Date.now() + 3_600_000), overrides.usosMax ?? null, hash)
    if (overrides.usos !== undefined || overrides.revogadoEm !== undefined) {
      await ds.getRepository(Convite).update(convite.id, { usos: overrides.usos ?? 0, revogadoEm: overrides.revogadoEm ?? null })
    }
    return token
  }

  it('inexistente → ConviteInvalido', async () => {
    await expect(verificar.execute('token-que-nao-existe')).rejects.toThrow(ConviteInvalido)
  })

  it('expirado → ConviteExpirado', async () => {
    const token = await criarConvite({ expiraEm: new Date(Date.now() - 1000) })
    await expect(verificar.execute(token)).rejects.toThrow(ConviteExpirado)
  })

  it('revogado → ConviteRevogado', async () => {
    const token = await criarConvite({ revogadoEm: new Date() })
    await expect(verificar.execute(token)).rejects.toThrow(ConviteRevogado)
  })

  it('esgotado → ConviteEsgotado', async () => {
    const token = await criarConvite({ usosMax: 1, usos: 1 })
    await expect(verificar.execute(token)).rejects.toThrow(ConviteEsgotado)
  })

  it('válido → devolve o rótulo e NÃO consome uso', async () => {
    const token = await criarConvite({ rotulo: 'Pessoal', usosMax: 1 })

    await expect(verificar.execute(token)).resolves.toEqual({ rotulo: 'Pessoal' })

    const hash = ConvitesRepository.hash(token)
    const convite = await convites.buscarPorHash(hash)
    expect(convite!.usos).toBe(0)
  })
})
