import { randomBytes } from 'node:crypto'
import { NomeDaSalaInvalido } from './erros'

const TAMANHO_MAXIMO_SLUG = 32
const TAMANHO_MAXIMO_NOME = 40
// 3 bytes = 6 hex. Com o hífen, o sufixo ocupa 7 dos 32 caracteres do slug.
const TAMANHO_SUFIXO_PRIVADO = 3
const TAMANHO_MAXIMO_BASE_PRIVADA = TAMANHO_MAXIMO_SLUG - TAMANHO_SUFIXO_PRIVADO * 2 - 1

/**
 * Slug da sala: minúsculo, sem acento, espaços e `_` viram `-`, só `[a-z0-9-]`, hífens
 * colapsados, aparado nas pontas, 1..32 — é ele que identifica a sala na URL e no metadata
 * do SFU.
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
 * Slug de uma Sala privada: o slug comum, encurtado para o sufixo caber, mais bytes aleatórios.
 * É o sufixo que impede chegar na sala adivinhando o nome — ela não aparece no saguão e o link
 * é o único caminho até ela.
 */
export function slugDaSalaPrivada(nome: string): string {
  // Segundo trim depois do corte, pela mesma razão do corte em 32 dentro de slugDaSala: a
  // fronteira pode cair em cima de um hífen e deixá-lo pendurado antes do sufixo.
  const base = slugDaSala(nome).slice(0, TAMANHO_MAXIMO_BASE_PRIVADA).replace(/-+$/, '')
  return `${base}-${randomBytes(TAMANHO_SUFIXO_PRIVADO).toString('hex')}`
}

/**
 * "nome da sala, trim, 1..40" — lança NomeDaSalaInvalido se vazio OU se o slug sair vazio
 * (nome só de emoji/pontuação passa no teste de tamanho, mas não vira sala nenhuma; continua
 * sendo nome_da_sala_invalido, não "sem nome").
 *
 * Não é o único caminho para um nomeDaSala: quem não digitou nada não passa por aqui — ganha um
 * nome de `salas/nomeAutomatico.ts`, que já sai pronto para virar slug. Esta função só valida
 * o que a pessoa escreveu; string vazia continua sendo erro, não "ausência".
 */
export function validarNomeDaSala(bruto: unknown): string {
  if (typeof bruto !== 'string') throw new NomeDaSalaInvalido()
  const nome = bruto.trim()
  if (nome.length < 1 || nome.length > TAMANHO_MAXIMO_NOME) throw new NomeDaSalaInvalido()
  if (slugDaSala(nome).length === 0) throw new NomeDaSalaInvalido()
  return nome
}
