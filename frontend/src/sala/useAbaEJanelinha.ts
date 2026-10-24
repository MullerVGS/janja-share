import { useEffect, useState } from 'react'

/**
 * Se a aba da Sala está à vista e se algum vídeo dela está na janelinha (PiP) — os dois lugares
 * de onde uma Tela se vê fora do palco. A janelinha vem dos eventos do documento, que sobem de
 * qualquer `<video>`: quem a abre é o quadro em foco, mas quem decide a assinatura é a Sala.
 */
export function useAbaEJanelinha(): { abaVisivel: boolean; janelinha: boolean } {
  const [abaVisivel, setAbaVisivel] = useState(() => document.visibilityState !== 'hidden')
  const [janelinha, setJanelinha] = useState(() => Boolean(document.pictureInPictureElement))

  useEffect(() => {
    const aba = () => setAbaVisivel(document.visibilityState !== 'hidden')
    const pip = () => setJanelinha(Boolean(document.pictureInPictureElement))
    document.addEventListener('visibilitychange', aba)
    document.addEventListener('enterpictureinpicture', pip, true)
    document.addEventListener('leavepictureinpicture', pip, true)
    return () => {
      document.removeEventListener('visibilitychange', aba)
      document.removeEventListener('enterpictureinpicture', pip, true)
      document.removeEventListener('leavepictureinpicture', pip, true)
    }
  }, [])

  return { abaVisivel, janelinha }
}
