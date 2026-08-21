import { Request } from 'express'

/** IP interpretado pelo Express conforme o salto confiável definido em bootstrap.ts. */
export function ipDoPedido(req: Request): string {
  return req.ip ?? 'desconhecido'
}
