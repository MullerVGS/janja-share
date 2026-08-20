import { randomBytes, scrypt, ScryptOptions, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const TAMANHO_SALT = 16
const TAMANHO_HASH = 32
const PARAMETROS_SCRYPT: ScryptOptions = { N: 16384, r: 8, p: 1 }

// scryptSync trava o event loop ~50-100ms por chamada — num app público, um IP martelando
// senha erradas paralisaria o processo inteiro (todo mundo, não só quem está atacando).
// promisify(scrypt) larga o trabalho pro libuv e devolve o event loop livre entre chamadas.
type ScryptAsync = (senha: string, salt: Buffer, tamanho: number, opcoes: ScryptOptions) => Promise<Buffer>
const scryptAsync = promisify(scrypt) as unknown as ScryptAsync

/** scrypt do node:crypto (sem dependência nativa nova). Guardado como "salt:hash" em hex. */
export async function cifrar(senha: string): Promise<string> {
  const salt = randomBytes(TAMANHO_SALT)
  const hash = await scryptAsync(senha, salt, TAMANHO_HASH, PARAMETROS_SCRYPT)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

/**
 * Comparação em tempo constante (timingSafeEqual) contra o hash guardado. Guardado malformado
 * (formato errado, hex inválido) devolve false — nunca lança, para uma linha corrompida no
 * banco não virar 500 em vez de "senha errada".
 */
export async function confere(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split(':')
  if (partes.length !== 2) return false
  const [saltHex, hashHex] = partes
  if (saltHex.length === 0 || hashHex.length === 0) return false
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false

  try {
    const salt = Buffer.from(saltHex, 'hex')
    const hashEsperado = Buffer.from(hashHex, 'hex')
    const hashCalculado = await scryptAsync(senha, salt, hashEsperado.length, PARAMETROS_SCRYPT)
    return timingSafeEqual(hashCalculado, hashEsperado)
  } catch {
    return false
  }
}
