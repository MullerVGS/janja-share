import { vi } from 'vitest'

/**
 * Os pedaços do navegador que o jsdom não tem: WebAudio, tela cheia e picture-in-picture.
 *
 * Cada `habilitar*` põe de pé uma versão mínima da API real e devolve o estado que ela produz,
 * para o teste afirmar sobre o que o navegador *faria* — e não sobre chamadas a dublês nossos.
 * Sem chamar nenhuma delas, o ambiente é o de um navegador sem esses recursos, que é o outro
 * caso a testar.
 */

export interface WebAudioFalso {
  /** A amplitude que o analisador devolve em todas as raias (0–255). */
  amplitude: number
  /** Quantos `AudioContext` estão abertos agora — zero depois de uma limpeza correta. */
  abertos: number
  /** As faixas que chegaram a virar fonte de áudio. */
  faixas: MediaStreamTrack[]
}

export function habilitarWebAudio(): WebAudioFalso {
  const estado: WebAudioFalso = { amplitude: 0, abertos: 0, faixas: [] }

  class AnalisadorFalso {
    fftSize = 2048
    smoothingTimeConstant = 0.8
    get frequencyBinCount() {
      return this.fftSize / 2
    }
    getByteFrequencyData(alvo: Uint8Array) {
      alvo.fill(estado.amplitude)
    }
  }

  class FluxoFalso {
    constructor(public faixas: MediaStreamTrack[]) {}
  }

  class ContextoFalso {
    constructor() {
      estado.abertos += 1
    }
    createAnalyser() {
      return new AnalisadorFalso()
    }
    createMediaStreamSource(fluxo: FluxoFalso) {
      estado.faixas.push(...fluxo.faixas)
      return { connect: () => {} }
    }
    async close() {
      estado.abertos -= 1
    }
  }

  vi.stubGlobal('AudioContext', ContextoFalso)
  vi.stubGlobal('MediaStream', FluxoFalso)
  return estado
}

export interface TelaCheiaFalsa {
  /** O elemento em tela cheia agora, como `document.fullscreenElement`. */
  atual: Element | null
  /** Sai da tela cheia como o Esc faria. */
  sair(): void
}

/**
 * Tela cheia de verdade em miniatura: `requestFullscreen` troca o `fullscreenElement` e avisa
 * pelo `fullscreenchange`, que é como o estado do quadro tem de chegar à UI.
 */
export function habilitarTelaCheia(): TelaCheiaFalsa {
  const estado: TelaCheiaFalsa = { atual: null, sair: () => trocar(null) }

  function trocar(elemento: Element | null) {
    estado.atual = elemento
    document.dispatchEvent(new Event('fullscreenchange'))
  }

  definir(document, 'fullscreenEnabled', { get: () => true })
  definir(document, 'fullscreenElement', { get: () => estado.atual })
  definir(document, 'exitFullscreen', { value: async () => trocar(null) })
  definir(Element.prototype, 'requestFullscreen', {
    value(this: Element) {
      trocar(this)
      return Promise.resolve()
    },
  })

  return estado
}

export interface PiPFalso {
  /** O vídeo na janelinha agora, como `document.pictureInPictureElement`. */
  atual: HTMLVideoElement | null
}

export function habilitarPiP(): PiPFalso {
  const estado: PiPFalso = { atual: null }

  definir(document, 'pictureInPictureEnabled', { get: () => true })
  definir(document, 'pictureInPictureElement', { get: () => estado.atual })
  definir(document, 'exitPictureInPicture', {
    value: async () => {
      const saindo = estado.atual
      estado.atual = null
      saindo?.dispatchEvent(new Event('leavepictureinpicture'))
    },
  })
  definir(HTMLVideoElement.prototype, 'requestPictureInPicture', {
    value(this: HTMLVideoElement) {
      estado.atual = this
      this.dispatchEvent(new Event('enterpictureinpicture'))
      return Promise.resolve({})
    },
  })

  return estado
}

/**
 * Estas APIs não existem no jsdom, então não há o que espionar: elas são criadas aqui e
 * desfeitas no fim do teste. `configurable` é o que permite desfazer.
 */
const criadas: { alvo: object; nome: string }[] = []

function definir(alvo: object, nome: string, descritor: PropertyDescriptor) {
  Object.defineProperty(alvo, nome, { ...descritor, configurable: true })
  criadas.push({ alvo, nome })
}

export function esquecerONavegadorFalso(): void {
  for (const { alvo, nome } of criadas.splice(0)) {
    Reflect.deleteProperty(alvo, nome)
  }
}
