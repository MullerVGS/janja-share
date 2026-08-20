// Mesma tolerância a barra repetida e caixa do PREFIXO_API em shared/http/spa.ts, e pelo
// mesmo motivo: é o que decide se a guarda de admin se aplica, então tem que reconhecer a
// rota do jeito que o Express casaria — não do jeito que um `startsWith` ingênuo leria.
const PREFIXO_ADMIN = /^\/+api\/+admin(\/|$)/i

/** true se o caminho é (ou está sob) /api/admin. */
export function ehRotaAdmin(caminho: string): boolean {
  return PREFIXO_ADMIN.test(caminho)
}
