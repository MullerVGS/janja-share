import { NomeInvalido } from '../shared/erros'

/**
 * "seu nome" — 1..40 chars, trim, não vazio (contrato). Validado à mão em vez de via
 * class-validator porque QUALQUER violação — ausência, tipo errado, vazio, longo demais — mapeia
 * para o mesmo código `nome_invalido`, e o ValidationPipe global não distingue isso de outros
 * 400 genéricos. Não confundir com `validarNomeDaSala` (shared/slug.ts): nome de pessoa não
 * precisa virar slug, então nome só de emoji passa aqui.
 */
export function validarNome(bruto: unknown): string {
  if (typeof bruto !== 'string') throw new NomeInvalido()
  const nome = bruto.trim()
  if (nome.length < 1 || nome.length > 40) throw new NomeInvalido()
  return nome
}
