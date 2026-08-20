import { IsOptional } from 'class-validator'

/** Ver o comentário de CriarSalaDto — mesmo motivo para os decoradores soltos. */
export class EntrarSalaDto {
  @IsOptional() senha?: unknown
  @IsOptional() seuNome?: unknown
}
