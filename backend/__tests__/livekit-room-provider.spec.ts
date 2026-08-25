// Porta fechada de verdade: qualquer método que bata na rede real (sem jest.spyOn) tem que
// lançar SfuIndisponivel, nunca travar esperando ou engolir o erro. Setado antes de qualquer
// chamada a env() (memoizado no primeiro uso) — os testes com jest.spyOn abaixo não se importam
// com o valor real, porque a chamada de rede nunca chega a sair.
process.env.LIVEKIT_HOST_INTERNO = 'http://127.0.0.1:1'

import { ParticipantInfo, Room, RoomServiceClient, TrackInfo, TrackSource } from 'livekit-server-sdk'
import { LivekitRoomProvider } from '../src/shared/livekit/livekit-room.provider'
import { SfuIndisponivel } from '../src/shared/erros'

// O `name` real de uma sala no SFU é `<slug>-<nonce>` — as fixtures abaixo simulam
// isso de propósito (nome do SFU ≠ slug) pra provar que o provider resolve slug/nome pelo
// metadata, não pelo `name` bruto.
function sala(overrides: Partial<Room> = {}): Room {
  return new Room({
    name: 'jogatina-a1b2c3d4',
    metadata: JSON.stringify({ slug: 'jogatina', nome: 'Jogatina' }),
    numParticipants: 0,
    maxParticipants: 30,
    ...overrides,
  })
}

function participante(nome: string, publicandoTela = false): ParticipantInfo {
  const tracks: TrackInfo[] = publicandoTela ? [new TrackInfo({ source: TrackSource.SCREEN_SHARE })] : []
  return new ParticipantInfo({ identity: `${nome}-abc123`, name: nome, tracks })
}

describe('LivekitRoomProvider — SFU fora do ar (rede real)', () => {
  it('participantes() lança SfuIndisponivel em vez de engolir o erro', async () => {
    const provider = new LivekitRoomProvider()
    await expect(provider.participantes('jogatina-a1b2c3d4')).rejects.toThrow(SfuIndisponivel)
  })

  it('listarSalas() lança SfuIndisponivel — devolver [] mentiria "não há salas"', async () => {
    const provider = new LivekitRoomProvider()
    await expect(provider.listarSalas()).rejects.toThrow(SfuIndisponivel)
  })

  it('listarSalasSemCache() também lança quando o SFU falha', async () => {
    const provider = new LivekitRoomProvider()
    await expect(provider.listarSalasSemCache()).rejects.toThrow(SfuIndisponivel)
  })
})

describe('LivekitRoomProvider — listarSalas() com o SDK dublado', () => {
  afterEach(() => jest.restoreAllMocks())

  it('monta a lista com pessoas, telas no ar e cheia, a partir de listRooms + listParticipants', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([participante('Ana', true), participante('Bea')])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista).toEqual([
      {
        slug: 'jogatina',
        nomeNoSfu: 'jogatina-a1b2c3d4',
        nome: 'Jogatina',
        privada: false,
        pessoas: ['Ana', 'Bea'],
        telasNoAr: 1,
        cheia: false,
      },
    ])
  })

  it('lê a visibilidade do metadata; ausência continua significando sala pública', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([
      sala({ metadata: JSON.stringify({ slug: 'jogatina', nome: 'Jogatina', privada: true }) }),
      sala({ name: 'legada-aabbccdd', metadata: JSON.stringify({ slug: 'legada', nome: 'Legada' }) }),
    ])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista.map((item) => ({ slug: item.slug, privada: item.privada }))).toEqual([
      { slug: 'jogatina', privada: true },
      { slug: 'legada', privada: false },
    ])
  })

  it('resolve slug e nome pelo metadata, não pelo `name` bruto do SFU', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([
      new Room({ name: 'jogatina-ffff0000', metadata: JSON.stringify({ slug: 'jogatina', nome: 'Jogatina à Noite' }), numParticipants: 0, maxParticipants: 30 }),
    ])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    const [encontrada] = await provider.listarSalas()

    expect(encontrada.slug).toBe('jogatina')
    expect(encontrada.nome).toBe('Jogatina à Noite')
    expect(encontrada.nomeNoSfu).toBe('jogatina-ffff0000')
  })

  it('sala vazia (em carência) aparece na lista', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([
      sala({ name: 'vazia-11112222', metadata: JSON.stringify({ slug: 'vazia', nome: 'Vazia' }) }),
    ])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista).toEqual([
      {
        slug: 'vazia',
        nomeNoSfu: 'vazia-11112222',
        nome: 'Vazia',
        privada: false,
        pessoas: [],
        telasNoAr: 0,
        cheia: false,
      },
    ])
  })

  it('cheia quando pessoas atinge a lotação máxima (30)', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue(Array.from({ length: 30 }, (_, i) => participante(`p${i}`)))

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista[0].cheia).toBe(true)
  })

  it('metadata ausente ou malformada cai no `name` bruto do SFU como slug e nome, sem lançar', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala({ name: 'sem-metadata-abcd1234', metadata: '' })])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista[0].slug).toBe('sem-metadata-abcd1234')
    expect(lista[0].nome).toBe('sem-metadata-abcd1234')
  })

  it('cache de 2s: duas chamadas seguidas não repetem a ida ao SFU', async () => {
    const espiaoListRooms = jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    await provider.listarSalas(1000)
    await provider.listarSalas(2999) // ainda dentro dos 2s (< 1000+2000)

    expect(espiaoListRooms).toHaveBeenCalledTimes(1)
  })

  it('cache expira: depois de 2s, chama o SFU de novo', async () => {
    const espiaoListRooms = jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    await provider.listarSalas(1000)
    await provider.listarSalas(3001) // 1000 + 2000 = 3000, isto já passou

    expect(espiaoListRooms).toHaveBeenCalledTimes(2)
  })
})

describe('LivekitRoomProvider — listarSalasSemCache()', () => {
  afterEach(() => jest.restoreAllMocks())

  it('nunca serve do cache — duas chamadas seguidas, mesmo dentro de 2s, vão ao SFU as duas vezes', async () => {
    const espiaoListRooms = jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    await provider.listarSalasSemCache(1000)
    await provider.listarSalasSemCache(1500) // 500ms depois — dentro dos 2s do cache normal

    expect(espiaoListRooms).toHaveBeenCalledTimes(2)
  })

  it('mesmo servindo listarSalas() em cache antes, listarSalasSemCache() ainda vai ao SFU', async () => {
    const espiaoListRooms = jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    await provider.listarSalas(1000) // popula o cache
    await provider.listarSalasSemCache(1500) // não pode servir do cache que acabou de encher

    expect(espiaoListRooms).toHaveBeenCalledTimes(2)
  })
})

describe('LivekitRoomProvider — criarSala()', () => {
  afterEach(() => jest.restoreAllMocks())

  it('chama createRoom com nome opaco e visibilidade no metadata', async () => {
    const espiao = jest.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue(sala())

    const provider = new LivekitRoomProvider()
    const nomeNoSfu = await provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina', privada: true })

    // Nome interno ≠ slug, mas começa com "slug-" e tem um sufixo hex depois.
    expect(nomeNoSfu).toMatch(/^jogatina-[0-9a-f]{8}$/)
    expect(nomeNoSfu).not.toBe('jogatina')

    expect(espiao).toHaveBeenCalledWith({
      name: nomeNoSfu,
      emptyTimeout: 60,
      departureTimeout: 120,
      maxParticipants: 30,
      metadata: JSON.stringify({ slug: 'jogatina', nome: 'Jogatina', privada: true }),
    })
  })

  it('duas chamadas para o mesmo slug geram nomes no SFU diferentes (o nonce muda)', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue(sala())

    const provider = new LivekitRoomProvider()
    const a = await provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina', privada: false })
    const b = await provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina', privada: false })

    expect(a).not.toBe(b)
  })

  it('falha do SFU lança SfuIndisponivel', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'createRoom').mockRejectedValue(new Error('fora do ar'))

    const provider = new LivekitRoomProvider()
    await expect(provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina', privada: false })).rejects.toThrow(
      SfuIndisponivel,
    )
  })

  it('invalida o cache ao criar uma sala', async () => {
    const espiaoListRooms = jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])
    jest.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue(sala())

    const provider = new LivekitRoomProvider()
    await provider.listarSalas(1000) // popula o cache com uma lista vazia
    await provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina', privada: false })
    await provider.listarSalas(1500) // ainda dentro dos 2s do cache original — mas foi invalidado

    expect(espiaoListRooms).toHaveBeenCalledTimes(2) // a leitura pré-criação e a leitura pós-criação
  })
})
