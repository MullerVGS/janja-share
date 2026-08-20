import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

/**
 * Assistir melhor uma tela alheia: tela cheia, janelinha (PiP) e o tamanho em que ela aparece.
 *
 * Tudo aqui é API do navegador, não do LiveKit — e nenhuma delas existe em todo lugar. A regra
 * é a mesma para as três: sem suporte, o botão não aparece. Um botão que não faz nada é pior
 * do que botão nenhum, porque a pessoa fica achando que o app quebrou.
 */

export type Ajuste = 'caber' | 'pixelAPixel'

export const AJUSTES: Record<Ajuste, { rotulo: string; explicacao: string }> = {
  caber: { rotulo: 'Caber', explicacao: 'a tela inteira dentro do quadro' },
  pixelAPixel: { rotulo: 'Pixel a pixel', explicacao: 'tamanho original, arraste para andar por ela' },
}

export function ehAjuste(valor: unknown): valor is Ajuste {
  return typeof valor === 'string' && Object.hasOwn(AJUSTES, valor)
}

export function outroAjuste(ajuste: Ajuste): Ajuste {
  return ajuste === 'caber' ? 'pixelAPixel' : 'caber'
}

export function temTelaCheia(): boolean {
  return document.fullscreenEnabled === true
}

export function temPiP(): boolean {
  return 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled === true
}

/**
 * Tela cheia do **quadro**, não do vídeo: assim a etiqueta com o nome e os próprios botões
 * continuam à mão lá dentro. Quem sai é sempre o navegador (Esc, ou outro elemento tomando o
 * lugar), então o estado vem do `fullscreenchange` e nunca de um `useState` nosso adivinhando.
 */
export function useTelaCheia(alvo: RefObject<HTMLElement | null>): { cheia: boolean; alternar(): void } {
  const [cheia, setCheia] = useState(false)

  useEffect(() => {
    const conferir = () => setCheia(alvo.current !== null && document.fullscreenElement === alvo.current)
    document.addEventListener('fullscreenchange', conferir)
    return () => document.removeEventListener('fullscreenchange', conferir)
  }, [alvo])

  const alternar = useCallback(() => {
    const elemento = alvo.current
    if (!elemento) return
    if (document.fullscreenElement === elemento) void document.exitFullscreen()
    else void elemento.requestFullscreen()
  }, [alvo])

  return { cheia, alternar }
}

/**
 * A janelinha flutuante do Chrome. Cabe um vídeo por vez na janelinha do navegador inteiro, e
 * quem a fecha é ela mesma — daí o estado vir dos eventos do elemento.
 */
export function usePiP(video: RefObject<HTMLVideoElement | null>): { emPiP: boolean; alternar(): void } {
  const [emPiP, setEmPiP] = useState(false)

  useEffect(() => {
    const elemento = video.current
    if (!elemento) return
    const entrou = () => setEmPiP(true)
    const saiu = () => setEmPiP(false)
    elemento.addEventListener('enterpictureinpicture', entrou)
    elemento.addEventListener('leavepictureinpicture', saiu)
    return () => {
      elemento.removeEventListener('enterpictureinpicture', entrou)
      elemento.removeEventListener('leavepictureinpicture', saiu)
    }
  }, [video])

  const alternar = useCallback(() => {
    const elemento = video.current
    if (!elemento) return
    if (document.pictureInPictureElement === elemento) void document.exitPictureInPicture()
    else void elemento.requestPictureInPicture()
  }, [video])

  return { emPiP, alternar }
}

/**
 * Arrastar para andar pela tela — o par natural do pixel a pixel, onde a imagem é maior que o
 * quadro. Anda no sentido do papel, não do ponteiro: puxar para a esquerda traz o que estava
 * à direita.
 */
export function useArraste(ativo: boolean) {
  const de = useRef<{ ponteiro: number; x: number; y: number } | null>(null)

  return {
    onPointerDown(evento: PointerEvent<HTMLElement>) {
      if (!ativo) return
      evento.currentTarget.setPointerCapture?.(evento.pointerId)
      de.current = { ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY }
    },
    onPointerMove(evento: PointerEvent<HTMLElement>) {
      const inicio = de.current
      if (!inicio || inicio.ponteiro !== evento.pointerId) return
      evento.currentTarget.scrollLeft -= evento.clientX - inicio.x
      evento.currentTarget.scrollTop -= evento.clientY - inicio.y
      de.current = { ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY }
    },
    onPointerUp(evento: PointerEvent<HTMLElement>) {
      if (de.current?.ponteiro !== evento.pointerId) return
      de.current = null
      evento.currentTarget.releasePointerCapture?.(evento.pointerId)
    },
    onPointerCancel(evento: PointerEvent<HTMLElement>) {
      if (de.current?.ponteiro === evento.pointerId) de.current = null
    },
  }
}
