import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common'
import { Request } from 'express'
import { env } from '../shared/env'
import { hostBate } from '../shared/host'
import { ehRotaAdmin } from './rota-admin'

/**
 * Global (registrado como APP_GUARD em app.module.ts) — roda em toda requisição, não só nos
 * controllers que se lembrarem de declarar `@UseGuards()`. A decisão "isto é admin?" vem do
 * caminho da requisição (ehRotaAdmin), não de um decorator por controller: um controller de
 * admin novo nasce protegido de graça, porque não existe opt-in para esquecer.
 *
 * Fora do Host de HOST_ADMIN, 404 puro (NotFoundException — nunca 401/403, que revelariam
 * que a rota existe).
 */
@Injectable()
export class AdminHostGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (!ehRotaAdmin(req.path)) return true
    if (!hostBate(req.headers.host, env().hostAdmin)) throw new NotFoundException()
    return true
  }
}
