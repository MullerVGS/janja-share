import { Injectable } from '@nestjs/common'
import { ConviteInvalido } from '../../../shared/erros'
import { ConvitesRepository } from '../../repositories/convites.repository'

// id de rota que não é UUID nunca vai bater com a coluna `id uuid` — falhar rápido aqui evita
// que o Postgres estoure "invalid input syntax for type uuid" (que viraria 500, não 404).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
export class RevogarConviteUseCase {
  constructor(private readonly convites: ConvitesRepository) {}

  async execute(id: string): Promise<void> {
    if (!UUID.test(id)) throw new ConviteInvalido()
    const existia = await this.convites.revogar(id)
    if (!existia) throw new ConviteInvalido()
  }
}
