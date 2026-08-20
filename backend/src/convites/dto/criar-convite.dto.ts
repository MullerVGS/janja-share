import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator'

export class CriarConviteDto {
  @IsString() @Length(1, 60) rotulo!: string

  @IsInt() @Min(1) @Max(8760) validadeHoras!: number

  // "inteiro >=1 ou null (ilimitado)" (contrato) — ValidateIf pula a checagem de IsInt/Min
  // quando o valor já é null, que é um valor válido e não "ausente".
  @ValidateIf((o: CriarConviteDto) => o.usosMax !== null)
  @IsInt()
  @Min(1)
  usosMax!: number | null
}
