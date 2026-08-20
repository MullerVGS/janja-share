import { IsOptional } from 'class-validator'

/**
 * Sem decoradores de tipo/formato: o contrato reserva códigos de erro próprios para o nome da
 * sala (nome_da_sala_invalido) e o nome da pessoa (nome_invalido) — a checagem real mora nos
 * use cases (shared/slug.ts, salas/nome.ts), não aqui. `@IsOptional()` só existe para os campos
 * sobreviverem ao `whitelist: true` do ValidationPipe global, que descarta qualquer propriedade
 * sem NENHUM decorador de class-validator.
 */
export class CriarSalaDto {
  @IsOptional() nome?: unknown
  @IsOptional() senha?: unknown
  @IsOptional() seuNome?: unknown
}
