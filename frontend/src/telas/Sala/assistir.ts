import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Assistir melhor uma tela alheia: tela cheia e janelinha (PiP).
 *
 * Tudo aqui é API do navegador, não do LiveKit — e nenhuma delas existe em todo lugar. A regra
 * é a mesma para as duas: sem suporte, o botão não aparece. Um botão que não faz nada é pior
 * do que botão nenhum, porque a pessoa fica achando que o app quebrou.
 */

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
 *
 * Os ouvintes são presos ao elemento que existir na montagem: quem usa isto é o quadro de tela,
 * onde o `<video>` nasce junto com o quadro e fica até ele sair.
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
