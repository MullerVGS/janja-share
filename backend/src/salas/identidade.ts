import { randomBytes } from 'node:crypto'

/**
 * Slug ascii só para a identidade do LiveKit — não confundir com `slugDaSala`
 * (shared/slug.ts), que é o slug da SALA e lança se sair vazio. Aqui um nome que não sobra
 * nada representável (ex.: só emoji) cai no fallback "convidado" em vez de erro: a pessoa já
 * passou por `validarNome`, então uma identidade genérica é melhor que travar a entrada por
 * causa de um detalhe que ninguém vê.
 */
function slugDeIdentidade(nome: string): string {
  const normalizado = nome
    .normalize('NFD')
    // \u0300-\u036f: bloco de marcas diacríticas combinantes que o NFD separa da letra base.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalizado || 'convidado'
}

/** identity = <slug(nome)>-<6 hex> (contrato). */
export function gerarIdentidade(nome: string): string {
  return `${slugDeIdentidade(nome)}-${randomBytes(3).toString('hex')}`
}
