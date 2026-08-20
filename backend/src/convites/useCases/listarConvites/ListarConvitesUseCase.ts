import { Injectable } from '@nestjs/common'
import { calcularEstado } from '../../estado-convite'
import { ConvitesRepository } from '../../repositories/convites.repository'

export interface ConviteListado {
  id: string
  rotulo: string
  criadoEm: string
  expiraEm: string
  usosMax: number | null
  usos: number
  revogadoEm: string | null
  ativo: boolean
}

@Injectable()
export class ListarConvitesUseCase {
  constructor(private readonly convites: ConvitesRepository) {}

  async execute(): Promise<ConviteListado[]> {
    const lista = await this.convites.listar()
    const agora = new Date()
    return lista.map((c) => ({
      id: c.id,
      rotulo: c.rotulo,
      criadoEm: c.criadoEm.toISOString(),
      expiraEm: c.expiraEm.toISOString(),
      usosMax: c.usosMax,
      usos: c.usos,
      revogadoEm: c.revogadoEm ? c.revogadoEm.toISOString() : null,
      ativo: calcularEstado(c, agora) === 'valido',
    }))
  }
}
