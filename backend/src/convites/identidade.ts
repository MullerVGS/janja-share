import { randomBytes } from 'node:crypto'
import { slug } from './texto'

/** identity = <slug(nome)>-<6 hex> (contrato). */
export function gerarIdentidade(nome: string): string {
  return `${slug(nome)}-${randomBytes(3).toString('hex')}`
}
