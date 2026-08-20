import { IsOptional, IsString } from 'class-validator'

/** Ver o comentário de CriarSalaDto — mesmo motivo para `senha` ter `@IsString()` e `seuNome` não. */
export class EntrarSalaDto {
  @IsOptional() @IsString() senha?: string
  @IsOptional() seuNome?: unknown
}
