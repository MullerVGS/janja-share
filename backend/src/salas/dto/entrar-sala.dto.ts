import { IsOptional } from 'class-validator'

/** Ver o comentário de CriarSalaDto — `seuNome` fica solto de propósito. */
export class EntrarSalaDto {
  @IsOptional() seuNome?: unknown
}
