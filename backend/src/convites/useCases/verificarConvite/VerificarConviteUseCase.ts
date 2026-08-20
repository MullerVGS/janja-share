import { Injectable } from '@nestjs/common'
import { ConviteInvalido, erroDoEstado } from '../../../shared/erros'
import { calcularEstado } from '../../estado-convite'
import { ConvitesRepository } from '../../repositories/convites.repository'

@Injectable()
export class VerificarConviteUseCase {
  constructor(private readonly convites: ConvitesRepository) {}

  /** Pré-checagem da tela de entrada — não consome uso. */
  async execute(token: string): Promise<{ rotulo: string }> {
    const hash = ConvitesRepository.hash(token)
    const convite = await this.convites.buscarPorHash(hash)
    if (!convite) throw new ConviteInvalido()

    const estado = calcularEstado(convite)
    if (estado !== 'valido') throw erroDoEstado(estado)

    return { rotulo: convite.rotulo }
  }
}
