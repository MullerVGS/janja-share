import { Transform } from 'class-transformer'
import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CriarConviteDto {
  // Transform roda antes da validação (ValidationPipe com transform:true) — "   " vira "" e
  // cai no @Length(1,60) como vazio, em vez de virar um convite de verdade com rótulo em branco.
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  rotulo!: string

  @IsInt() @Min(1) @Max(8760) validadeHoras!: number

  // "inteiro >=1 ou null (ilimitado)" (contrato) — ValidateIf pula a checagem de IsInt/Min
  // quando o valor já é null, que é um valor válido e não "ausente".
  @ValidateIf((o: CriarConviteDto) => o.usosMax !== null)
  @IsInt()
  @Min(1)
  usosMax!: number | null
}
