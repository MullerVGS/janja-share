import { Injectable } from '@nestjs/common'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'

export interface SalaNaLista {
  slug: string
  nome: string
  pessoas: string[]
  telasNoAr: number
  cheia: boolean
}

@Injectable()
export class ListarSalasUseCase {
  constructor(private readonly room: LivekitRoomProvider) {}

  /**
   * O SFU é a verdade de quais salas existem, quem está dentro e quem publica tela.
   * `listarSalas()` já lança SfuIndisponivel (503) se o SFU não responder — devolver lista
   * vazia mentiria "não há salas" (contrato), então não há try/catch aqui.
   */
  async execute(): Promise<SalaNaLista[]> {
    const salasNoSfu = await this.room.listarSalas()

    return salasNoSfu
      .filter((sala) => sala.privada !== true)
      .map((sala) => ({
        slug: sala.slug,
        nome: sala.nome,
        pessoas: sala.pessoas,
        telasNoAr: sala.telasNoAr,
        cheia: sala.cheia,
      }))
  }
}
