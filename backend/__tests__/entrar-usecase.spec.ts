import { DataSource } from 'typeorm'
import { Convite } from '../src/shared/db/entidades/convite.entity'
import { ConvitesRepository } from '../src/convites/repositories/convites.repository'
import { EntrarUseCase } from '../src/convites/useCases/entrar/EntrarUseCase'
import { ConviteEsgotado, ConviteExpirado, ConviteInvalido, ConviteRevogado, NomeInvalido } from '../src/shared/erros'
import { LivekitTokenProvider } from '../src/shared/livekit/livekit-token.provider'
import { dataSourceDeTeste } from '../test/banco'

describe('EntrarUseCase — estados do convite', () => {
  let ds: DataSource
  let convites: ConvitesRepository
  let entrar: EntrarUseCase

  beforeAll(async () => {
    ds = await dataSourceDeTeste()
    await ds.runMigrations()
    convites = new ConvitesRepository(ds.getRepository(Convite))
    entrar = new EntrarUseCase(convites, new LivekitTokenProvider())
  })

  afterAll(() => ds.destroy())

  async function criarConvite(overrides: { expiraEm?: Date; usosMax?: number | null; usos?: number; revogadoEm?: Date | null } = {}): Promise<string> {
    const token = ConvitesRepository.gerarToken()
    const hash = ConvitesRepository.hash(token)
    const convite = await convites.criar('Teste', overrides.expiraEm ?? new Date(Date.now() + 3_600_000), overrides.usosMax ?? null, hash)
    if (overrides.usos !== undefined || overrides.revogadoEm !== undefined) {
      await ds.getRepository(Convite).update(convite.id, { usos: overrides.usos ?? 0, revogadoEm: overrides.revogadoEm ?? null })
    }
    return token
  }

  it('inexistente → ConviteInvalido', async () => {
    await expect(entrar.execute('token-que-nao-existe', 'Fulano')).rejects.toThrow(ConviteInvalido)
  })

  it('expirado → ConviteExpirado', async () => {
    const token = await criarConvite({ expiraEm: new Date(Date.now() - 1000) })
    await expect(entrar.execute(token, 'Fulano')).rejects.toThrow(ConviteExpirado)
  })

  it('revogado → ConviteRevogado', async () => {
    const token = await criarConvite({ revogadoEm: new Date() })
    await expect(entrar.execute(token, 'Fulano')).rejects.toThrow(ConviteRevogado)
  })

  it('esgotado → ConviteEsgotado', async () => {
    const token = await criarConvite({ usosMax: 1, usos: 1 })
    await expect(entrar.execute(token, 'Fulano')).rejects.toThrow(ConviteEsgotado)
  })

  it('nome inválido não consome o convite — a tentativa seguinte com nome bom ainda funciona', async () => {
    const token = await criarConvite({ usosMax: 1 })
    await expect(entrar.execute(token, '')).rejects.toThrow(NomeInvalido)
    await expect(entrar.execute(token, 'Fulano')).resolves.toMatchObject({ nome: 'Fulano' })
  })

  it('caminho feliz: consome 1 uso e deriva a identidade do nome', async () => {
    const token = await criarConvite({ usosMax: 2 })
    const resultado = await entrar.execute(token, 'María José')
    expect(resultado.identidade).toMatch(/^maria-jose-[0-9a-f]{6}$/)
    expect(resultado.nome).toBe('María José')
  })

  it('concorrência: dois entrar simultâneos num convite de 1 uso → um entra, o outro recebe convite_esgotado', async () => {
    const token = await criarConvite({ usosMax: 1 })

    const resultados = await Promise.allSettled([entrar.execute(token, 'Um'), entrar.execute(token, 'Dois')])

    const sucesso = resultados.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof entrar.execute>>> => r.status === 'fulfilled')
    const falha = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(sucesso).toHaveLength(1)
    expect(falha).toHaveLength(1)
    expect(falha[0].reason).toBeInstanceOf(ConviteEsgotado)
  })
})
