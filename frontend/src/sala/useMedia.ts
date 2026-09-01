import { useEffect, useState } from 'react'

/**
 * Se uma media query casa agora — o mesmo `@media` do CSS, respondido em React.
 *
 * Quase toda a responsividade da sala é CSS puro. Três coisas, porém, não são questão de
 * aparência e sim de comportamento: a barra lateral vira camada (e por isso precisa nascer
 * fechada, com véu por trás), a gaveta faz o mesmo, e a faixa de avatares mostra menos gente
 * antes de cortar em "+N". Nenhuma delas se resolve com uma regra de estilo.
 *
 * Fora do navegador (jsdom sem `matchMedia`, SSR) a resposta é `false`: a composição larga é a
 * que não depende de nenhum desses ajustes.
 */
export function useMedia(consulta: string): boolean {
  const [casa, setCasa] = useState(() => window.matchMedia?.(consulta).matches ?? false)

  useEffect(() => {
    const lista = window.matchMedia?.(consulta)
    if (!lista) return
    setCasa(lista.matches)
    const aoMudar = (evento: MediaQueryListEvent) => setCasa(evento.matches)
    lista.addEventListener('change', aoMudar)
    return () => lista.removeEventListener('change', aoMudar)
  }, [consulta])

  return casa
}
