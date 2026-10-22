import { useCallback, useEffect, useState } from 'react'
import { Track, type RemoteTrackPublication, type Room } from 'livekit-client'

/** O que se deixa de ver de alguém: a imagem e o som dela. A voz da pessoa continua. */
const FONTES_DA_TELA = [Track.Source.ScreenShare, Track.Source.ScreenShareAudio]

function publicacoesDaTela(sala: Room, identidade: string): RemoteTrackPublication[] {
  const participante = sala.remoteParticipants.get(identidade)
  if (!participante) return []
  return FONTES_DA_TELA.map((fonte) => participante.getTrackPublication(fonte) as RemoteTrackPublication | undefined).filter(
    (publicacao): publicacao is RemoteTrackPublication => Boolean(publicacao && 'setSubscribed' in publicacao),
  )
}

export interface DeixarDeVer {
  /** Quem esta pessoa escolheu não ver, pela identidade. */
  naoVejo: ReadonlySet<string>
  deixarDeVer(identidade: string): void
  verDeNovo(identidade: string): void
}

/**
 * Deixar de ver a Tela de alguém sem sair da Sala: desassina a imagem e o som dela, poupando a
 * banda de quem assiste, e volta com um clique.
 *
 * A escolha é por Pessoa, não por publicação: a Tela que a mesma Pessoa republica (troca de
 * codec, religação) ou começa de novo chega com assinatura automática, e a cada mudança do palco
 * (`versao`) ela é desassinada outra vez. Só se impõe o "não ver"; o "ver" é pedido uma vez, no
 * clique — impor os dois brigaria com a reassinatura do cão de guarda, que desassina por um
 * instante de propósito.
 */
export function useDeixarDeVer(sala: Room | null, versao: number): DeixarDeVer {
  const [naoVejo, setNaoVejo] = useState<ReadonlySet<string>>(() => new Set())

  // Uma sala nova é outra sessão: a escolha não atravessa.
  useEffect(() => setNaoVejo(new Set()), [sala])

  useEffect(() => {
    if (!sala) return
    for (const identidade of naoVejo) {
      for (const publicacao of publicacoesDaTela(sala, identidade)) {
        if (publicacao.isDesired) publicacao.setSubscribed(false)
      }
    }
  }, [sala, versao, naoVejo])

  const deixarDeVer = useCallback((identidade: string) => {
    setNaoVejo((atual) => new Set([...atual, identidade]))
  }, [])

  const verDeNovo = useCallback(
    (identidade: string) => {
      setNaoVejo((atual) => new Set([...atual].filter((quem) => quem !== identidade)))
      if (!sala) return
      for (const publicacao of publicacoesDaTela(sala, identidade)) publicacao.setSubscribed(true)
    },
    [sala],
  )

  return { naoVejo, deixarDeVer, verDeNovo }
}
