import { MuitasGuardadas, MuitasSalas } from '../shared/erros'
import { estaAdormecida, type SalaNoSfu } from '../shared/livekit/livekit-room.provider'

/** Salas com gente (ou efêmeras na carência): o que pesa no SFU de verdade. */
export const TETO_ACORDADAS = 20

/**
 * Salas fixas sem ninguém. Folgado: a semana mais cheia medida teve 63 Salas, então mesmo com
 * todas fixas e nenhuma reaproveitada caberiam três semanas assim. Uma adormecida custa ao SFU
 * um objeto ocioso, e a listagem nem pergunta quem está nela (ver `buscarSalasDoSfu`).
 */
export const TETO_ADORMECIDAS = 200

/**
 * O teto de quem vai nascer. A nova Sala nasce acordada — quem a cria entra em seguida —, e a
 * fixa ainda vai adormecer um dia, por isso só ela esbarra também no teto das adormecidas.
 */
export function conferirTeto(salas: SalaNoSfu[], fixa: boolean): void {
  const adormecidas = salas.filter(estaAdormecida).length
  if (salas.length - adormecidas >= TETO_ACORDADAS) throw new MuitasSalas()
  if (fixa && adormecidas >= TETO_ADORMECIDAS) throw new MuitasGuardadas()
}
