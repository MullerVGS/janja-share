/**
 * O endereço da Sala privada escondido enquanto a pessoa compartilha (ticket 04): a barra de
 * endereço pode sair na Tela, e o sufixo sorteado do slug é a única chave da privada (ADR 0011).
 *
 * A troca é só da barra (`history.replaceState`), por fora do roteador: o app continua sabendo o
 * slug de verdade. O endereço verdadeiro fica na `sessionStorage` desta aba, e é ele que volta se
 * a pessoa der F5 com o endereço escondido — a máscara não pode custar a Sala.
 */
export const CHAVE_DA_MASCARA = 'janja-share.mascara'

/** O sufixo sorteado de 6 hex (ADR 0011), no fim do caminho. */
const SUFIXO_PRIVADO = /-[0-9a-f]{6}$/

export function caminhoMascarado(slug: string): string {
  return `/sala/${encodeURIComponent(slug.replace(SUFIXO_PRIVADO, '-oculta'))}`
}

interface Mascara {
  mascarado: string
  verdadeiro: string
}

function lerMascara(): Mascara | null {
  try {
    const cru: unknown = JSON.parse(sessionStorage.getItem(CHAVE_DA_MASCARA) ?? 'null')
    if (cru && typeof cru === 'object' && 'mascarado' in cru && 'verdadeiro' in cru) {
      const { mascarado, verdadeiro } = cru as Record<string, unknown>
      if (typeof mascarado === 'string' && typeof verdadeiro === 'string') return { mascarado, verdadeiro }
    }
  } catch {
    // Armazenamento bloqueado: sem máscara para desfazer.
  }
  return null
}

/** Esconde o endereço da barra. `verdadeiro` é caminho + busca, como o roteador o conhece. */
export function mascarar(slug: string, verdadeiro: string): void {
  const mascarado = caminhoMascarado(slug)
  try {
    sessionStorage.setItem(CHAVE_DA_MASCARA, JSON.stringify({ mascarado, verdadeiro }))
  } catch {
    // Sem armazenamento, um F5 mascarado não voltaria: melhor não mascarar.
    return
  }
  window.history.replaceState(window.history.state, '', mascarado)
}

/**
 * A aba está saindo (F5, fechar, navegar para fora). Nessa hora a Sala ainda desmonta e para a
 * Tela, e o desmascarar que viria junto apagaria justamente o que o próximo carregamento precisa
 * para voltar ao endereço verdadeiro.
 */
let saindo = false

/** Devolve o endereço verdadeiro à barra, se ela ainda mostra o mascarado. */
export function desmascarar(): void {
  if (saindo) return
  const mascara = lerMascara()
  try {
    sessionStorage.removeItem(CHAVE_DA_MASCARA)
  } catch {
    // nada a fazer
  }
  if (mascara && window.location.pathname === mascara.mascarado) {
    window.history.replaceState(window.history.state, '', mascara.verdadeiro)
  }
}

/**
 * Antes do roteador ler o endereço: a aba que recarregou com a barra mascarada volta ao
 * endereço verdadeiro da Sala.
 */
export function restaurarEnderecoMascarado(): void {
  saindo = false
  // `beforeunload` vem antes: é nele que o SDK desliga a Sala, e a Tela cai junto.
  const sair = () => {
    saindo = true
  }
  window.addEventListener('beforeunload', sair)
  window.addEventListener('pagehide', sair)
  window.addEventListener('pageshow', () => {
    saindo = false
  })
  const mascara = lerMascara()
  if (mascara && window.location.pathname === mascara.mascarado) {
    window.history.replaceState(window.history.state, '', mascara.verdadeiro)
  }
  try {
    sessionStorage.removeItem(CHAVE_DA_MASCARA)
  } catch {
    // nada a fazer
  }
}
