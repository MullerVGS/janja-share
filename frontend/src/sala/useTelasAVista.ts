import { useEffect, useRef, useState } from 'react'
import { Track, type RemoteTrack, type RemoteTrackPublication, type Room } from 'livekit-client'
import { foraDeVista, RESPIRO, type Vista } from './aVista'

/**
 * Pausa na assinatura a Tela alheia que não está à vista e a religa quando ela volta
 * (`aVista.ts`). Só mexe em Tela assinada: a que a pessoa deixou de ver é de `useDeixarDeVer`.
 *
 * O estado vale por faixa, não por publicação: refazer a assinatura (o cão de guarda, o
 * "Recarregar mídia") devolve o SFU ao padrão — mandando — enquanto o SDK continua lembrando o
 * pedido de pausa e não o repete. A faixa nova é o sinal de que o SFU esqueceu.
 */
export function useTelasAVista(sala: Room | null, versao: number, vista: Vista): void {
  const pausarEm = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pedidoNaFaixa = useRef(new WeakMap<RemoteTrack, boolean>())
  // O relógio que venceu muda a regra: a próxima passada pausa quem já esperou o respiro.
  const [venceu, setVenceu] = useState(0)
  const vencidas = useRef(new Set<string>())

  const { foco, pilhaVisivel, abaVisivel, janelinha } = vista

  useEffect(() => {
    if (!sala) return
    const relogios = pausarEm.current
    const regra: Vista = { foco, pilhaVisivel, abaVisivel, janelinha }

    function pedir(publicacao: RemoteTrackPublication, ligada: boolean) {
      if (publicacao.isEnabled !== ligada) publicacao.setEnabled(ligada)
      else if (!ligada && publicacao.track && pedidoNaFaixa.current.get(publicacao.track) !== false) {
        publicacao.emitTrackUpdate()
      }
      if (publicacao.track) pedidoNaFaixa.current.set(publicacao.track, ligada)
    }

    function esquecer(identidade: string) {
      clearTimeout(relogios.get(identidade))
      relogios.delete(identidade)
      vencidas.current.delete(identidade)
    }

    const presentes = new Set<string>()
    for (const participante of sala.remoteParticipants.values()) {
      const identidade = participante.identity
      const publicacao = participante.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined
      if (!publicacao || !publicacao.isDesired) continue
      presentes.add(identidade)

      const motivo = foraDeVista(identidade, regra)
      if (motivo === null) {
        esquecer(identidade)
        pedir(publicacao, true)
        continue
      }
      if (vencidas.current.has(identidade)) {
        pedir(publicacao, false)
        continue
      }
      if (!relogios.has(identidade)) {
        relogios.set(
          identidade,
          setTimeout(() => {
            relogios.delete(identidade)
            vencidas.current.add(identidade)
            setVenceu((n) => n + 1)
          }, RESPIRO[motivo]),
        )
      }
    }
    for (const identidade of relogios.keys()) if (!presentes.has(identidade)) esquecer(identidade)
    for (const identidade of vencidas.current) if (!presentes.has(identidade)) esquecer(identidade)
  }, [sala, versao, foco, pilhaVisivel, abaVisivel, janelinha, venceu])

  // Outra Sala é outra sessão: os relógios da anterior não valem.
  useEffect(() => {
    const relogios = pausarEm.current
    const pausadas = vencidas.current
    return () => {
      for (const relogio of relogios.values()) clearTimeout(relogio)
      relogios.clear()
      pausadas.clear()
    }
  }, [sala])
}
