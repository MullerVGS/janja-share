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
