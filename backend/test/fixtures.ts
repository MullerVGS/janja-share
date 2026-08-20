import { INestApplication } from '@nestjs/common'
import request from 'supertest'

/**
 * Cria um convite pela própria rota HTTP de admin (não INSERT direto) — assim o token que o
 * teste usa em /api/entrar passou pelo mesmo caminho de produção (geração + hash) que ele
 * exercitaria de verdade.
 */
export async function criarConviteDeTeste(
  app: INestApplication,
  overrides: { rotulo?: string; validadeHoras?: number; usosMax?: number | null } = {},
): Promise<{ id: string; token: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/admin/convites')
    .set('Host', process.env.HOST_ADMIN!)
    .send({
      rotulo: overrides.rotulo ?? 'Teste',
      validadeHoras: overrides.validadeHoras ?? 24,
      usosMax: overrides.usosMax === undefined ? null : overrides.usosMax,
    })
    .expect(201)
  const token = String(res.body.link).split('/c/')[1]
  return { id: res.body.id, token }
}

export interface RotaAdmin {
  metodo: 'get' | 'post' | 'delete' | 'put' | 'patch'
  caminho: string
}

/**
 * Lê o router do Express por baixo do Nest e devolve toda rota registrada sob /api/admin —
 * não uma lista mantida à mão (que teria exatamente o mesmo defeito do @UseGuards() opt-in
 * que este round corrigiu: alguém esquece de atualizá-la quando um endpoint novo nasce).
 */
export function rotasAdmin(app: INestApplication): RotaAdmin[] {
  const instancia = app.getHttpAdapter().getInstance() as { router?: { stack: unknown[] } }
  const pilha = instancia.router?.stack ?? []
  const rotas: RotaAdmin[] = []
  for (const camada of pilha as { route?: { path: string; methods: Record<string, boolean> } }[]) {
    const rota = camada.route
    if (!rota || typeof rota.path !== 'string' || !rota.path.startsWith('/api/admin')) continue
    for (const metodo of Object.keys(rota.methods)) {
      rotas.push({ metodo: metodo as RotaAdmin['metodo'], caminho: rota.path })
    }
  }
  return rotas
}
