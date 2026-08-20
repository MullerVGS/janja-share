import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const TAMANHO_SALT = 16
const TAMANHO_HASH = 32
const PARAMETROS_SCRYPT = { N: 16384, r: 8, p: 1 }

/** scrypt do node:crypto (sem dependência nativa nova). Guardado como "salt:hash" em hex. */
export function cifrar(senha: string): string {
  const salt = randomBytes(TAMANHO_SALT)
  const hash = scryptSync(senha, salt, TAMANHO_HASH, PARAMETROS_SCRYPT)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

/**
 * Comparação em tempo constante (timingSafeEqual) contra o hash guardado. Guardado malformado
 * (formato errado, hex inválido) devolve false — nunca lança, para uma linha corrompida no
 * banco não virar 500 em vez de "senha errada".
 */
export function confere(senha: string, guardado: string): boolean {
  const partes = guardado.split(':')
  if (partes.length !== 2) return false
  const [saltHex, hashHex] = partes
  if (saltHex.length === 0 || hashHex.length === 0) return false
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false

  try {
    const salt = Buffer.from(saltHex, 'hex')
    const hashEsperado = Buffer.from(hashHex, 'hex')
    const hashCalculado = scryptSync(senha, salt, hashEsperado.length, PARAMETROS_SCRYPT)
    return timingSafeEqual(hashCalculado, hashEsperado)
  } catch {
    return false
  }
}
