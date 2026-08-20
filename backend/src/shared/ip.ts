import { Request } from 'express'

/**
 * IP do freio (shared/freio.ts). Ponto único de leitura: `req.ip` só vale o que `trust proxy`
 * disser (bootstrap.ts) — atrás de reverse proxy e reverse proxy podem ser dois saltos, não um. O ajuste
 * fica de uma linha, aqui, quando o ticket de deploy confirmar o valor certo na VPS.
 */
export function ipDoPedido(req: Request): string {
  return req.ip ?? 'desconhecido'
}
