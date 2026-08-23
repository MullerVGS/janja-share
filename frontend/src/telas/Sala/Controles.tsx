import { useState, type ReactNode } from 'react'
import type { Room } from 'livekit-client'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import {
  IconeCamera,
  IconeCameraFechada,
  IconeChat,
  IconeMicrofone,
  IconeMicrofoneMudo,
  IconeSair,
  IconeSom,
  IconeSomMudo,
  IconeTela,
  IconeTrocarTela,
} from '../../ui/Icone'
import { SomSaindo } from './SomSaindo'
import estilos from './Controles.module.css'

interface Props {
  sala: Room | null
  compartilhamento: Compartilhamento
  chatAberto: boolean
  naoLidasNoChat: number
  /** Abre a gaveta no chat, ou a fecha se o chat já está à mostra. */
  aoAlternarChat(): void
  /** Onde a falha de microfone/câmera vira faixa na tela; `null` limpa a faixa anterior. */
  aoFalhar(mensagem: string | null): void
  aoSair(): void
}

const DISPOSITIVOS = {
  microfone: { esse: 'o microfone', aEsse: 'ao microfone' },
  camera: { esse: 'a câmera', aEsse: 'à câmera' },
} as const

/**
 * A frase que a pessoa lê quando abrir microfone ou câmera não dá certo. `null` é o único caso
 * de desistência silenciosa: `AbortError` é a troca interrompida no meio, não uma decisão.
 *
 * Diferente do compartilhamento de tela, aqui `NotAllowedError` NÃO é silêncio: não existe
 * seletor nativo para cancelar — é a permissão negada, e ela persiste. Sem faixa, o botão
 * ficaria morto para sempre sem nunca dizer por quê, que é exatamente o defeito que isto
 * conserta. O nome do erro é a parte estável do `DOMException`; a `message` muda com o
 * navegador e com o idioma do sistema.
 */
function fraseDaFalha(falha: unknown, qual: keyof typeof DISPOSITIVOS): string | null {
  const { esse, aEsse } = DISPOSITIVOS[qual]
  const nome = falha instanceof Error ? falha.name : ''
  if (nome === 'AbortError') return null
  if (nome === 'NotAllowedError' || nome === 'SecurityError')
    return `O navegador bloqueou o acesso ${aEsse}. Libere a permissão na barra de endereço e tente de novo.`
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError')
    return `Não encontrei ${esse} neste computador.`
  if (nome === 'NotReadableError') return `Outro programa está usando ${esse}. Feche-o e tente de novo.`
  return falha instanceof Error && falha.message ? falha.message : `Não foi possível abrir ${esse}.`
}

function Botao({
  rotulo,
  ligado,
  perigo = false,
  desabilitado = false,
  aoClicar,
  children,
}: {
  rotulo: string
  ligado?: boolean
  perigo?: boolean
  desabilitado?: boolean
  aoClicar(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={[estilos.botao, perigo ? estilos.perigo : ''].filter(Boolean).join(' ')}
      aria-pressed={ligado}
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      {children}
    </button>
  )
}

/**
 * A barra flutuante: microfone, câmera, tela, chat e a saída. Microfone e câmera começam
 * fechados — ninguém entra numa sala já transmitindo — e o estado de cada um está no próprio
 * botão, não escondido num menu.
 *
 * Trocar de tela e o áudio dela só aparecem transmitindo, porque são da SUA tela — e é por
 * isso que moram aqui, e não na pílula de um quadro: enquanto você assiste a de outra pessoa em
 * foco, a sua vive fora do palco (na Tira), sem pílula nenhuma desenhada para ela. A barra é o
 * único lugar que está sempre no ar, foco ou não.
 */
export function Controles({
  sala,
  compartilhamento,
  chatAberto,
  naoLidasNoChat,
  aoAlternarChat,
  aoFalhar,
  aoSair,
}: Props) {
  const [mudandoMicrofone, setMudandoMicrofone] = useState(false)
  const [mudandoCamera, setMudandoCamera] = useState(false)

  const microfoneLigado = sala?.localParticipant.isMicrophoneEnabled ?? false
  const cameraLigada = sala?.localParticipant.isCameraEnabled ?? false
  // Sem sala não há a quem pedir dispositivo nem tela: botão que não faz nada tem de dizer isso.
  const semSala = sala === null
  // Quem compartilha não se ouve: o medidor é a única resposta a "está saindo som?".
  const faixaDoAudioDaTela = compartilhamento.audioDaTela?.track?.mediaStreamTrack

  async function alternarMicrofone() {
    if (!sala) return
    aoFalhar(null)
    setMudandoMicrofone(true)
    try {
      await sala.localParticipant.setMicrophoneEnabled(!microfoneLigado)
    } catch (falha) {
      aoFalhar(fraseDaFalha(falha, 'microfone'))
    } finally {
      setMudandoMicrofone(false)
    }
  }

  async function alternarCamera() {
    if (!sala) return
    aoFalhar(null)
    setMudandoCamera(true)
    try {
      await sala.localParticipant.setCameraEnabled(!cameraLigada)
    } catch (falha) {
      aoFalhar(fraseDaFalha(falha, 'camera'))
    } finally {
      setMudandoCamera(false)
    }
  }

  return (
    <div className={estilos.barra}>
      <Botao
        rotulo={microfoneLigado ? 'Fechar microfone' : 'Abrir microfone'}
        ligado={microfoneLigado}
        desabilitado={semSala || mudandoMicrofone}
        aoClicar={() => void alternarMicrofone()}
      >
        {microfoneLigado ? <IconeMicrofone /> : <IconeMicrofoneMudo />}
      </Botao>

      <Botao
        rotulo={cameraLigada ? 'Fechar câmera' : 'Abrir câmera'}
        ligado={cameraLigada}
        desabilitado={semSala || mudandoCamera}
        aoClicar={() => void alternarCamera()}
      >
        {cameraLigada ? <IconeCamera /> : <IconeCameraFechada />}
      </Botao>

      <Botao
        rotulo={compartilhamento.ativo ? 'Parar de compartilhar a tela' : 'Compartilhar tela'}
        ligado={compartilhamento.ativo}
        desabilitado={semSala || compartilhamento.ocupado}
        aoClicar={() => void compartilhamento.alternar()}
      >
        <IconeTela />
      </Botao>

      {compartilhamento.ativo && (
        <>
          <Botao
            rotulo="Trocar de tela"
            desabilitado={compartilhamento.ocupado}
            aoClicar={() => void compartilhamento.trocarDeTela()}
          >
            <IconeTrocarTela />
          </Botao>
          <Botao
            rotulo={
              !compartilhamento.audioDaTela
                ? 'Áudio da tela — marque "compartilhar áudio" no seletor'
                : compartilhamento.audioDaTela.isMuted
                  ? 'Devolver o áudio da tela'
                  : 'Calar o áudio da tela'
            }
            ligado={Boolean(compartilhamento.audioDaTela && !compartilhamento.audioDaTela.isMuted)}
            desabilitado={!compartilhamento.audioDaTela}
            aoClicar={() => void compartilhamento.alternarAudioDaTela()}
          >
            {compartilhamento.audioDaTela && !compartilhamento.audioDaTela.isMuted ? <IconeSom /> : <IconeSomMudo />}
          </Botao>
          {faixaDoAudioDaTela && <SomSaindo faixa={faixaDoAudioDaTela} />}
        </>
      )}

      <span className={estilos.separador} />

      <Botao rotulo="Chat" ligado={chatAberto} aoClicar={aoAlternarChat}>
        <IconeChat />
        {naoLidasNoChat > 0 && (
          <span className={estilos.contador} aria-label={`${naoLidasNoChat} mensagens não lidas`}>
            {naoLidasNoChat}
          </span>
        )}
      </Botao>

      <Botao rotulo="Sair da sala" perigo aoClicar={aoSair}>
        <IconeSair />
      </Botao>
    </div>
  )
}
