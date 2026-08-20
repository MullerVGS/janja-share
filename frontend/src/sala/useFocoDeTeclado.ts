import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Se o **teclado** está dentro de um elemento.
 *
 * Clicar num botão também o foca, e é isso que torna "tem foco dentro" uma pergunta ruim: com
 * ela, apertar o microfone deixaria a interface do palco acesa para sempre. Quem separa as duas
 * coisas é a modalidade da última entrada — tecla ou ponteiro —, que é o mesmo critério do
 * `:focus-visible` do navegador, só que observável de fora.
 *
 * Um elemento focado que é **removido** do DOM não emite `focusout` no Chrome, e o botão da tira
 * some justamente ao ser apertado (a peça sobe ao palco). Por isso a resposta é reconferida a
 * cada render contra quem de fato está com o foco: sem isso, a interação principal da tira
 * travaria a interface pelo resto da sessão.
 */
export function useFocoDeTeclado(alvo: RefObject<HTMLElement | null>): boolean {
  const [dentro, setDentro] = useState(false)
  const porTeclado = useRef(false)

  useEffect(() => {
    const contem = (no: EventTarget | Node | null) => Boolean(no && alvo.current?.contains(no as Node))

    const aoTeclar = () => {
      porTeclado.current = true
    }
    const aoApontar = () => {
      porTeclado.current = false
      setDentro(false)
    }
    const aoEntrar = (evento: FocusEvent) => {
      if (porTeclado.current && contem(evento.target)) setDentro(true)
    }
    const aoSair = (evento: FocusEvent) => {
      if (!contem(evento.relatedTarget)) setDentro(false)
    }

    window.addEventListener('keydown', aoTeclar, true)
    window.addEventListener('pointerdown', aoApontar, true)
    window.addEventListener('focusin', aoEntrar)
    window.addEventListener('focusout', aoSair)
    return () => {
      window.removeEventListener('keydown', aoTeclar, true)
      window.removeEventListener('pointerdown', aoApontar, true)
      window.removeEventListener('focusin', aoEntrar)
      window.removeEventListener('focusout', aoSair)
    }
  }, [alvo])

  useEffect(() => {
    if (dentro && !alvo.current?.contains(document.activeElement)) setDentro(false)
  })

  return dentro
}
