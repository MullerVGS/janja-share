// Porta fechada de verdade: qualquer método que bata na rede real (sem jest.spyOn) tem que
// lançar SfuIndisponivel, nunca travar esperando ou engolir o erro. Setado antes de qualquer
// chamada a env() (memoizado no primeiro uso) — os testes com jest.spyOn abaixo não se importam
// com o valor real, porque a chamada de rede nunca chega a sair.
process.env.LIVEKIT_HOST_INTERNO = 'http://127.0.0.1:1'

import { ParticipantInfo, Room, RoomServiceClient, TrackInfo, TrackSource } from 'livekit-server-sdk'
import { LivekitRoomProvider } from '../src/shared/livekit/livekit-room.provider'
import { SfuIndisponivel } from '../src/shared/erros'

function sala(overrides: Partial<Room> = {}): Room {
  return new Room({ name: 'jogatina', metadata: JSON.stringify({ nome: 'Jogatina' }), numParticipants: 0, maxParticipants: 12, ...overrides })
}

function participante(nome: string, publicandoTela = false): ParticipantInfo {
  const tracks: TrackInfo[] = publicandoTela ? [new TrackInfo({ source: TrackSource.SCREEN_SHARE })] : []
  return new ParticipantInfo({ identity: `${nome}-abc123`, name: nome, tracks })
}

describe('LivekitRoomProvider — SFU fora do ar (rede real)', () => {
  it('participantes() lança SfuIndisponivel em vez de engolir o erro', async () => {
    const provider = new LivekitRoomProvider()
    await expect(provider.participantes('jogatina')).rejects.toThrow(SfuIndisponivel)
  })

  it('listarSalas() lança SfuIndisponivel — devolver [] mentiria "não há salas"', async () => {
    const provider = new LivekitRoomProvider()
    await expect(provider.listarSalas()).rejects.toThrow(SfuIndisponivel)
  })
})

describe('LivekitRoomProvider — listarSalas() com o SDK dublado', () => {
  afterEach(() => jest.restoreAllMocks())

  it('monta a lista com pessoas, telas no ar e cheia, a partir de listRooms + listParticipants', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([participante('Ana', true), participante('Bea')])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista).toEqual([{ slug: 'jogatina', nome: 'Jogatina', pessoas: ['Ana', 'Bea'], telasNoAr: 1, cheia: false }])
  })

  it('sala vazia (em carência) aparece na lista', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala({ name: 'vazia', metadata: JSON.stringify({ nome: 'Vazia' }) })])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista).toEqual([{ slug: 'vazia', nome: 'Vazia', pessoas: [], telasNoAr: 0, cheia: false }])
  })

  it('cheia quando pessoas atinge a lotação máxima (12)', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala()])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue(Array.from({ length: 12 }, (_, i) => participante(`p${i}`)))

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista[0].cheia).toBe(true)
  })

  it('metadata ausente ou malformada cai no slug como nome, sem lançar', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'listRooms').mockResolvedValue([sala({ name: 'sem-nome', metadata: '' })])
    jest.spyOn(RoomServiceClient.prototype, 'listParticipants').mockResolvedValue([])

    const provider = new LivekitRoomProvider()
    const lista = await provider.listarSalas()

    expect(lista[0].nome).toBe('sem-nome')
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

describe('LivekitRoomProvider — criarSala()', () => {
  afterEach(() => jest.restoreAllMocks())

  it('chama createRoom com os valores exatos do contrato', async () => {
    const espiao = jest.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue(sala())

    const provider = new LivekitRoomProvider()
    await provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina' })

    expect(espiao).toHaveBeenCalledWith({
      name: 'jogatina',
      emptyTimeout: 60,
      departureTimeout: 120,
      maxParticipants: 12,
      metadata: JSON.stringify({ nome: 'Jogatina' }),
    })
  })

  it('falha do SFU lança SfuIndisponivel', async () => {
    jest.spyOn(RoomServiceClient.prototype, 'createRoom').mockRejectedValue(new Error('fora do ar'))

    const provider = new LivekitRoomProvider()
    await expect(provider.criarSala({ slug: 'jogatina', nomeDaSala: 'Jogatina' })).rejects.toThrow(SfuIndisponivel)
  })
})
