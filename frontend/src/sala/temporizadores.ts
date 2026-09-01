import { CriticalTimers } from 'livekit-client'

/**
 * Os timers do SDK contam fora da página.
 *
 * O `livekit-client` mede a saúde da sinalização com ping (5 s) e timeout (15 s) — em
 * `CriticalTimers`, que por padrão é o `setTimeout` da página. Aba em segundo plano com timers
 * limitados a um disparo por minuto (Safari, celular, Opera economizando bateria) vê o timeout
 * de 15 s disparar antes de qualquer pong: o SDK derruba a sinalização e reconecta a cada
 * minuto até uma reconexão não fechar. Um Web Worker não sofre essa limitação, e o SDK expõe
 * `CriticalTimers` exatamente para ser trocado por isto.
 *
 * O protocolo é mínimo: a página manda `agendar`/`limpar` com um id; o worker devolve o id
 * quando o timer dispara. O callback fica na página — o worker só guarda o relógio.
 */
export const CODIGO_DO_WORKER = `
const ativos = new Map();
self.onmessage = ({ data }) => {
  if (data.tipo === 'limpar') {
    const ativo = ativos.get(data.id);
    if (ativo) {
      (ativo.repete ? clearInterval : clearTimeout)(ativo.alca);
      ativos.delete(data.id);
    }
    return;
  }
  const disparar = () => {
    if (!data.repete) ativos.delete(data.id);
    self.postMessage(data.id);
  };
  ativos.set(data.id, {
    repete: data.repete,
    alca: data.repete ? setInterval(disparar, data.atrasoMs) : setTimeout(disparar, data.atrasoMs),
  });
};
`

type Alca = ReturnType<typeof setTimeout>

/** Troca os timers do SDK pelos do worker; devolve o que desfaz a troca. Sem Worker, não faz nada. */
export function instalarTemporizadoresForaDaPagina(): () => void {
  if (typeof Worker === 'undefined' || typeof URL.createObjectURL !== 'function') return () => {}

  const worker = new Worker(URL.createObjectURL(new Blob([CODIGO_DO_WORKER], { type: 'text/javascript' })))
  const callbacks = new Map<number, { rodar: () => void; repete: boolean }>()
  let proximoId = 1

  worker.onmessage = ({ data }: MessageEvent<number>) => {
    const ativo = callbacks.get(data)
    if (!ativo) return
    if (!ativo.repete) callbacks.delete(data)
    ativo.rodar()
  }

  function agendar(rodar: () => void, atrasoMs: number, repete: boolean): Alca {
    const id = proximoId++
    callbacks.set(id, { rodar, repete })
    worker.postMessage({ tipo: 'agendar', id, atrasoMs, repete })
    return id as unknown as Alca
  }

  function limpar(alca: Alca | undefined) {
    const id = alca as unknown as number
    if (!callbacks.delete(id)) return
    worker.postMessage({ tipo: 'limpar', id })
  }

  const originais = {
    setTimeout: CriticalTimers.setTimeout,
    setInterval: CriticalTimers.setInterval,
    clearTimeout: CriticalTimers.clearTimeout,
    clearInterval: CriticalTimers.clearInterval,
  }

  // `TimerHandler` admite string por herança do `eval`; o SDK só passa funções.
  const comoFuncao = (rodar: TimerHandler, args: unknown[]) => {
    if (typeof rodar !== 'function') throw new TypeError('temporizadores fora da página só aceitam função')
    return () => rodar(...args)
  }

  CriticalTimers.setTimeout = (rodar, atrasoMs, ...args) => agendar(comoFuncao(rodar, args), atrasoMs ?? 0, false)
  CriticalTimers.setInterval = (rodar, atrasoMs, ...args) => agendar(comoFuncao(rodar, args), atrasoMs ?? 0, true)
  CriticalTimers.clearTimeout = limpar
  CriticalTimers.clearInterval = limpar

  return () => {
    Object.assign(CriticalTimers, originais)
    callbacks.clear()
    worker.terminate()
  }
}
