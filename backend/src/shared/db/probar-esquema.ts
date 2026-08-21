import { DataSource } from 'typeorm'

/**
 * Sonda se a migration já rodou antes de aceitar tráfego. O erro sobe para o boot falhar cedo,
 * como já acontece com variáveis de ambiente ausentes.
 */
export async function probarEsquema(ds: DataSource): Promise<void> {
  await ds.query('SELECT 1 FROM salas LIMIT 1')
}
