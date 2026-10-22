import { Injectable } from '@nestjs/common'
import { estaAdormecida, LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'

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
   * O SFU é a verdade de quais salas existem, quem está dentro e quem publica tela. O saguão
   * mostra as públicas acordadas: a Sala adormecida é de um grupo que vai voltar pelo link, e
   * não um convite a quem passa (ADR 0013).
   * `listarSalas()` já lança SfuIndisponivel (503) se o SFU não responder — devolver lista
   * vazia mentiria "não há salas" (contrato), então não há try/catch aqui.
   */
  async execute(): Promise<SalaNaLista[]> {
    const salasNoSfu = await this.room.listarSalas()

    return salasNoSfu
      .filter((sala) => sala.privada !== true && !estaAdormecida(sala))
      .map((sala) => ({
        slug: sala.slug,
        nome: sala.nome,
        pessoas: sala.pessoas,
        telasNoAr: sala.telasNoAr,
        cheia: sala.cheia,
      }))
  }
}
