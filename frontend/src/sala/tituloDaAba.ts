import { useEffect } from 'react'

export const TITULO_DO_PRODUTO = 'janja-share'

/**
 * O título da aba diz o que importa a quem deixou a aba de fundo: as mensagens não lidas entre
 * parênteses, "● ao vivo" enquanto a própria Tela está no ar e o nome da Sala.
 */
export function tituloDaAba({
  nomeDaSala,
  aoVivo = false,
  naoLidas = 0,
}: {
  nomeDaSala?: string | null
  aoVivo?: boolean
  naoLidas?: number
}): string {
  const partes = [
    naoLidas > 0 ? `(${naoLidas > 99 ? '99+' : naoLidas})` : null,
    aoVivo ? '● ao vivo ·' : null,
    nomeDaSala ? `${nomeDaSala} · ${TITULO_DO_PRODUTO}` : TITULO_DO_PRODUTO,
  ]
  return partes.filter(Boolean).join(' ')
}

/** Escreve o título enquanto a tela está montada e devolve o do produto ao sair. */
export function useTituloDaAba(estado: Parameters<typeof tituloDaAba>[0]): void {
  const titulo = tituloDaAba(estado)
  useEffect(() => {
    document.title = titulo
  }, [titulo])
  useEffect(
    () => () => {
      document.title = TITULO_DO_PRODUTO
    },
    [],
  )
}
