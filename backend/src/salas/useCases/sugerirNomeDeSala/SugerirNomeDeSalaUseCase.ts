import { Injectable } from '@nestjs/common'
import { slugDaSala } from '../../../shared/slug'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { gerarNomeDeSalaDisponivel } from '../../nomeAutomatico'

export interface SugestaoDeNomeDeSala {
  nome: string
}

@Injectable()
export class SugerirNomeDeSalaUseCase {
  constructor(private readonly room: LivekitRoomProvider) {}

  async execute(nomeAtual: unknown): Promise<SugestaoDeNomeDeSala> {
    // Uma sugestão tolera o cache curto: POST /salas relê o SFU sem cache antes de criar e
    // continua sendo a autoridade final contra uma colisão ocorrida entre sugestão e envio.
    const salasAtuais = await this.room.listarSalas()
    const slugAtual = typeof nomeAtual === 'string' ? slugDaSala(nomeAtual) : ''
    return { nome: gerarNomeDeSalaDisponivel(salasAtuais, [slugAtual]) }
  }
}
