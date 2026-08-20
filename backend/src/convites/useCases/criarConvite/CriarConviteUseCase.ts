import { Injectable } from '@nestjs/common'
import { env } from '../../../shared/env'
import { ConvitesRepository } from '../../repositories/convites.repository'

export interface ConviteCriado {
  id: string
  rotulo: string
  link: string
}

const HORA_EM_MS = 3_600_000

@Injectable()
export class CriarConviteUseCase {
  constructor(private readonly convites: ConvitesRepository) {}

  /** O link aparece uma única vez aqui — o banco guarda só o hash do token (contrato). */
  async execute(rotulo: string, validadeHoras: number, usosMax: number | null): Promise<ConviteCriado> {
    const token = ConvitesRepository.gerarToken()
    const hash = ConvitesRepository.hash(token)
    const expiraEm = new Date(Date.now() + validadeHoras * HORA_EM_MS)
    const convite = await this.convites.criar(rotulo, expiraEm, usosMax, hash)
    const link = `${env().baseUrlPublica}/c/${token}`
    return { id: convite.id, rotulo: convite.rotulo, link }
  }
}
