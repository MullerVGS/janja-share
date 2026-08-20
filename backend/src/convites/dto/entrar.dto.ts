import { IsOptional } from 'class-validator'

/**
 * Sem decoradores de tipo/formato: o contrato reserva códigos de erro próprios para nome
 * (nome_invalido) e convite (convite_invalido/expirado/esgotado/revogado) — a checagem real
 * mora no use case (nome.ts, EntrarUseCase), não aqui. `@IsOptional()` só existe para o campo
 * sobreviver ao `whitelist: true` do ValidationPipe global, que descarta qualquer propriedade
 * sem NENHUM decorador de class-validator.
 */
export class EntrarDto {
  @IsOptional() convite?: unknown
  @IsOptional() nome?: unknown
}
