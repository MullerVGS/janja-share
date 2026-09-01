import { CriticalTimers } from 'livekit-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CODIGO_DO_WORKER, instalarTemporizadoresForaDaPagina } from '../src/sala/temporizadores'

type Mensagem = { tipo: 'agendar'; id: number; atrasoMs: number; repete: boolean } | { tipo: 'limpar'; id: number }

/** O Worker que o navegador daria, reduzido ao que o módulo usa: mandar e receber mensagens. */
class WorkerFalso {
  static ultimo: WorkerFalso | null = null
  recebidas: Mensagem[] = []
  onmessage: ((evento: { data: number }) => void) | null = null
  constructor() {
    WorkerFalso.ultimo = this
  }
  postMessage(mensagem: Mensagem) {
    this.recebidas.push(mensagem)
  }
  /** O worker avisando que o timer `id` disparou. */
  disparar(id: number) {
    this.onmessage?.({ data: id })
  }
  terminate() {}
}

function comWorkerNoNavegador() {
  vi.stubGlobal('Worker', WorkerFalso)
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:falso' })
}

const originais = {
  setTimeout: CriticalTimers.setTimeout,
  setInterval: CriticalTimers.setInterval,
  clearTimeout: CriticalTimers.clearTimeout,
  clearInterval: CriticalTimers.clearInterval,
}

describe('temporizadores fora da página', () => {
  let desinstalar: () => void = () => {}
  afterEach(() => {
    desinstalar()
    WorkerFalso.ultimo = null
    expect(CriticalTimers.setTimeout).toBe(originais.setTimeout)
  })

  it('sem Worker no navegador, os timers do SDK ficam como estão', () => {
    vi.stubGlobal('Worker', undefined)
    desinstalar = instalarTemporizadoresForaDaPagina()
    expect(CriticalTimers.setTimeout).toBe(originais.setTimeout)
    expect(CriticalTimers.setInterval).toBe(originais.setInterval)
  })

  it('o setTimeout do SDK passa a contar no worker: a página não agenda nada, e o callback roda no aviso', () => {
    comWorkerNoNavegador()
    const naPagina = vi.spyOn(globalThis, 'setTimeout')
    desinstalar = instalarTemporizadoresForaDaPagina()
    const callback = vi.fn()

    const alca = CriticalTimers.setTimeout(callback, 15_000)

    expect(naPagina).not.toHaveBeenCalled()
    const worker = WorkerFalso.ultimo!
    expect(worker.recebidas).toEqual([{ tipo: 'agendar', id: alca, atrasoMs: 15_000, repete: false }])
    expect(callback).not.toHaveBeenCalled()
    worker.disparar(alca as number)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('clearTimeout avisa o worker, e um aviso atrasado do timer limpo não roda nada', () => {
    comWorkerNoNavegador()
    desinstalar = instalarTemporizadoresForaDaPagina()
    const callback = vi.fn()

    const alca = CriticalTimers.setTimeout(callback, 15_000)
    CriticalTimers.clearTimeout(alca)
    const worker = WorkerFalso.ultimo!
    worker.disparar(alca as number)

    expect(worker.recebidas.at(-1)).toEqual({ tipo: 'limpar', id: alca })
    expect(callback).not.toHaveBeenCalled()
  })

  it('setInterval roda a cada aviso, até o clearInterval', () => {
    comWorkerNoNavegador()
    desinstalar = instalarTemporizadoresForaDaPagina()
    const callback = vi.fn()

    const alca = CriticalTimers.setInterval(callback, 5_000)
    const worker = WorkerFalso.ultimo!
    expect(worker.recebidas).toEqual([{ tipo: 'agendar', id: alca, atrasoMs: 5_000, repete: true }])
    worker.disparar(alca as number)
    worker.disparar(alca as number)
    CriticalTimers.clearInterval(alca)
    worker.disparar(alca as number)

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('desinstalar devolve os timers do SDK e encerra o worker', () => {
    comWorkerNoNavegador()
    desinstalar = instalarTemporizadoresForaDaPagina()
    const worker = WorkerFalso.ultimo!
    const terminar = vi.spyOn(worker, 'terminate')

    desinstalar()

    expect(terminar).toHaveBeenCalled()
    expect(CriticalTimers.setInterval).toBe(originais.setInterval)
  })
})

describe('o código que roda dentro do worker', () => {
  afterEach(() => vi.useRealTimers())

  /** Executa o script do worker num `self` de mentira, com os timers falsos do teste. */
  function workerDeMentira() {
    const self = { onmessage: null as ((evento: { data: Mensagem }) => void) | null, postMessage: vi.fn() }
    new Function('self', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', CODIGO_DO_WORKER)(
      self,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
    )
    return { mandar: (data: Mensagem) => self.onmessage!({ data }), avisos: self.postMessage }
  }

  it('um timer avisa o id uma vez, no atraso pedido', () => {
    vi.useFakeTimers()
    const { mandar, avisos } = workerDeMentira()
    mandar({ tipo: 'agendar', id: 7, atrasoMs: 15_000, repete: false })

    vi.advanceTimersByTime(14_999)
    expect(avisos).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(avisos).toHaveBeenCalledWith(7)
    vi.advanceTimersByTime(60_000)
    expect(avisos).toHaveBeenCalledTimes(1)
  })

  it('um intervalo avisa a cada período, e limpar para os avisos', () => {
    vi.useFakeTimers()
    const { mandar, avisos } = workerDeMentira()
    mandar({ tipo: 'agendar', id: 3, atrasoMs: 5_000, repete: true })

    vi.advanceTimersByTime(10_000)
    expect(avisos).toHaveBeenCalledTimes(2)
    mandar({ tipo: 'limpar', id: 3 })
    vi.advanceTimersByTime(10_000)
    expect(avisos).toHaveBeenCalledTimes(2)
  })

  it('limpar um timer antes do atraso cancela o aviso', () => {
    vi.useFakeTimers()
    const { mandar, avisos } = workerDeMentira()
    mandar({ tipo: 'agendar', id: 9, atrasoMs: 1_000, repete: false })
    mandar({ tipo: 'limpar', id: 9 })

    vi.advanceTimersByTime(5_000)
    expect(avisos).not.toHaveBeenCalled()
  })
})
