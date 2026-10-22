import { ConnectionQuality, ConnectionState } from 'livekit-client'

export type TomDaConexao = 'bom' | 'medio' | 'ruim'

export interface EstadoDaConexao {
  /** O rótulo curto do painel de voz. */
  rotulo: string
  /** A cor do rótulo. */
  tom: TomDaConexao
  /** A cor das barrinhas de sinal: a qualidade medida, quando conectado. */
  sinal: TomDaConexao
  /** A explicação longa, ao clicar no rótulo. */
  explicacao: string
}

/** Preso sem conectar por mais que isto, o problema deixa de ser "esperar" e vira a rede. */
export const PRESO_SEM_ROTA_MS = 10_000

function sinalDa(qualidade: ConnectionQuality | undefined): TomDaConexao {
  if (qualidade === ConnectionQuality.Poor) return 'medio'
  if (qualidade === ConnectionQuality.Lost) return 'ruim'
  return 'bom'
}

/**
 * O estado da conexão como o painel de voz o diz: um rótulo curto colorido e uma explicação
 * humana ao clicar. `presoHaMs` é quanto tempo a Sala está sem conectar desde a última vez que
 * esteve conectada (ou desde o começo).
 */
export function estadoDaConexao(
  conexao: ConnectionState,
  qualidade: ConnectionQuality | undefined,
  presoHaMs: number,
): EstadoDaConexao {
  if (conexao === ConnectionState.Connected) {
    const sinal = sinalDa(qualidade)
    return {
      rotulo: 'Voz conectada',
      tom: 'bom',
      sinal,
      explicacao:
        sinal === 'bom'
          ? 'Você está conectado(a) à sala. A imagem e o som chegam por aqui.'
          : sinal === 'medio'
            ? 'Conectado(a), mas a sua rede está oscilando: a imagem pode perder nitidez e o som pode picotar.'
            : 'Conectado(a), mas o servidor deixou de ouvir a sua rede. Se não voltar sozinho, recarregue a mídia.',
    }
  }
  if (presoHaMs >= PRESO_SEM_ROTA_MS) {
    return {
      rotulo: 'Sem rota',
      tom: 'ruim',
      sinal: 'ruim',
      explicacao:
        'Sua rede parece bloquear a mídia (UDP). Tente outra rede ou desligue a VPN; a sala continua tentando sozinha.',
    }
  }
  if (conexao === ConnectionState.Disconnected) {
    return {
      rotulo: 'Desconectado',
      tom: 'ruim',
      sinal: 'ruim',
      explicacao: 'A conexão com a sala caiu. Vamos tentar de novo em um instante.',
    }
  }
  if (conexao === ConnectionState.Connecting) {
    return {
      rotulo: 'Conectando',
      tom: 'medio',
      sinal: 'medio',
      explicacao: 'Estamos abrindo o caminho até o servidor da sala. Costuma levar um ou dois segundos.',
    }
  }
  return {
    rotulo: 'Reconectando',
    tom: 'medio',
    sinal: 'medio',
    explicacao: 'A conexão piscou e a sala está voltando sozinha. Sua tela, se estava no ar, volta junto.',
  }
}
