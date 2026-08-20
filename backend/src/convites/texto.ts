/** Slug ascii para a identidade do LiveKit: minúsculas, sem acento, só [a-z0-9-]. */
export function slug(nome: string): string {
  const normalizado = nome
    .normalize('NFD')
    // \u0300-\u036f: bloco de marcas diacríticas combinantes que o NFD separa da letra base.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // nome só com caracteres que o slug não consegue representar (ex.: só emoji) — fallback fixo
  // em vez de identidade tipo "-a1b2c3", que o LiveKit aceitaria mas seria ilegível no painel.
  return normalizado || 'convidado'
}
