import { IsOptional, IsString, MaxLength } from 'class-validator'

/** Ver o comentário de CriarSalaDto — `seuNome` fica solto de propósito. */
export class EntrarSalaDto {
  @IsOptional() seuNome?: unknown
  /** O `?k=` do link da Sala fixa. Uma carga de nome com 40 caracteres cabe com folga em 512. */
  @IsOptional() @IsString() @MaxLength(512) assinatura?: string
}
