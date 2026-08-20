import { Injectable } from '@nestjs/common'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { SalasRepository } from '../../repositories/salas.repository'

export interface SalaNaLista {
  slug: string
  nome: string
  pessoas: string[]
  telasNoAr: number
  temSenha: boolean
  cheia: boolean
}

@Injectable()
export class ListarSalasUseCase {
  constructor(
    private readonly room: LivekitRoomProvider,
    private readonly salas: SalasRepository,
  ) {}

  /**
   * O SFU é a verdade de quais salas existem, quem está dentro e quem publica tela; o banco só
   * sabe quais têm senha. `listarSalas()` já lança SfuIndisponivel (503) se o SFU não responder
   * — devolver lista vazia mentiria "não há salas" (contrato), então não há try/catch aqui.
   */
  async execute(): Promise<SalaNaLista[]> {
    const [salasNoSfu, comSenha] = await Promise.all([this.room.listarSalas(), this.salas.listarSlugsComSenha()])

    return salasNoSfu.map((sala) => ({
      slug: sala.slug,
      nome: sala.nome,
      pessoas: sala.pessoas,
      telasNoAr: sala.telasNoAr,
      temSenha: comSenha.has(sala.slug),
      cheia: sala.cheia,
    }))
  }
}
