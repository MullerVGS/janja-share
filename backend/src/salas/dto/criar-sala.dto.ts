import { IsBoolean, IsOptional, IsString } from 'class-validator'

/**
 * `nome` e `seuNome` ficam soltos (`@IsOptional()` sem `@IsString()`): o contrato reserva
 * códigos de erro próprios para os dois (nome_da_sala_invalido, nome_invalido) e a checagem
 * real mora nos use cases (shared/slug.ts, salas/nome.ts) — inclusive o tipo, porque
 * `validarNome`/`validarNomeDaSala` já tratam "não é string" como inválido com o código certo.
 *
 * `senha` é diferente: não tem código de erro próprio, então não pode passar por um use case
 * pra virar `nome_invalido` por engano. `@IsString()` recusa `{"senha": 1234}` (PIN numérico,
 * erro fácil de cliente) com `400 validacao` em vez de `201` e uma sala aberta em silêncio.
 */
export class CriarSalaDto {
  @IsOptional() nome?: unknown
  @IsOptional() @IsString() senha?: string
  @IsOptional() @IsBoolean() privada?: boolean
  @IsOptional() seuNome?: unknown
}
