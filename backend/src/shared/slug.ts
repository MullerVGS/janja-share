import { NomeDaSalaInvalido } from './erros'

const TAMANHO_MAXIMO_SLUG = 32
const TAMANHO_MAXIMO_NOME = 40

/**
 * Slug da sala: minúsculo, sem acento, espaços e `_` viram `-`, só `[a-z0-9-]`, hífens
 * colapsados, aparado nas pontas, 1..32 — é ele que vira o `name` da sala no SFU e a chave
 * primária em `salas` (varchar(32)).
 *
 * Pode devolver string vazia (nome só de emoji ou pontuação) — quem decide se isso é erro é
 * `validarNomeDaSala`, não esta função.
 */
export function slugDaSala(nome: string): string {
  const bruto = nome
    .normalize('NFD')
    // \u0300-\u036f: bloco de marcas diacríticas combinantes que o NFD separa da letra base.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, TAMANHO_MAXIMO_SLUG)
  // O corte em 32 pode expor um hífen pendurado bem na fronteira — segundo trim, só do fim
  // (o início já não tem hífen desde o trim de cima, e o corte nunca mexe no início).
  return bruto.replace(/-+$/, '')
}

/**
 * "nome da sala, trim, 1..40" — lança NomeDaSalaInvalido se vazio OU se o slug sair vazio
 * (nome só de emoji/pontuação: passa no teste de tamanho mas não vira sala nenhuma — ruling do
 * ticket: é nome_da_sala_invalido, não "sem nome").
 */
export function validarNomeDaSala(bruto: unknown): string {
  if (typeof bruto !== 'string') throw new NomeDaSalaInvalido()
  const nome = bruto.trim()
  if (nome.length < 1 || nome.length > TAMANHO_MAXIMO_NOME) throw new NomeDaSalaInvalido()
  if (slugDaSala(nome).length === 0) throw new NomeDaSalaInvalido()
  return nome
}
