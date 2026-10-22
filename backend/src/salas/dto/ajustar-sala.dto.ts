import { IsBoolean, IsOptional } from 'class-validator'

/** Ver o comentário de CriarSalaDto — `nome` fica solto de propósito. */
export class AjustarSalaDto {
  @IsOptional() nome?: unknown
  @IsOptional() @IsBoolean() privada?: boolean
}
