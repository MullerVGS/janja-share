import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common'
import { Request } from 'express'
import { env } from '../shared/env'
import { hostBate } from '../shared/host'

/**
 * `/api/admin/*` só existe no Host configurado em HOST_ADMIN — fora dele, 404 (nunca 401/403,
 * que revelariam que a rota existe).
 */
@Injectable()
export class AdminHostGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (!hostBate(req.headers.host, env().hostAdmin)) throw new NotFoundException()
    return true
  }
}
