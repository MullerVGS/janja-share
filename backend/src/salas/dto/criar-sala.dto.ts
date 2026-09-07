import { IsBoolean, IsOptional } from 'class-validator'

/**
 * `nome` e `seuNome` ficam soltos (`@IsOptional()` sem `@IsString()`): o contrato reserva
 * códigos de erro próprios para os dois (nome_da_sala_invalido, nome_invalido) e a checagem
 * real mora nos use cases (shared/slug.ts, salas/nome.ts) — inclusive o tipo, porque
 * `validarNome`/`validarNomeDaSala` já tratam "não é string" como inválido com o código certo.
 */
export class CriarSalaDto {
  @IsOptional() nome?: unknown
  @IsOptional() @IsBoolean() privada?: boolean
  @IsOptional() seuNome?: unknown
}
