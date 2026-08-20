import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Room } from 'livekit-client'
import type { Aba } from '../../sala/lateral'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import {
  IconeAjustes,
  IconeCamera,
  IconeCameraFechada,
  IconeChat,
  IconeMicrofone,
  IconeMicrofoneMudo,
  IconeSair,
  IconeSom,
  IconeSomMudo,
  IconeTela,
} from '../../ui/Icone'
import estilos from './Controles.module.css'

interface Props {
  sala: Room | null
  compartilhamento: Compartilhamento
  /** A aba à mostra na lateral; `null` com a lateral fechada. */
  abaAberta: Aba | null
  /** Abre a lateral nessa aba, ou a fecha se ela já está à mostra. */
  aoAlternarAba(aba: Aba): void
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
  dica,
  ligado,
  perigo = false,
  desabilitado = false,
  aoClicar,
  children,
}: {
  rotulo: string
  /** Substitui o rótulo no `title` quando há algo a explicar — tipicamente por que está apagado. */
  dica?: string
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
      title={dica ?? rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      {children}
    </button>
  )
}

/** Quantas leituras por segundo do nível: o bastante para a barra acompanhar a voz. */
const LEITURAS_POR_SEGUNDO = 10

/** Sem WebAudio não há nível para mostrar, e um indicador sempre zerado mentiria. */
function temMedidorDeNivel(): boolean {
  return typeof AudioContext !== 'undefined' && typeof MediaStream !== 'undefined'
}

/** A média quadrática das raias, 0–1 — o mesmo cálculo que o `createAudioAnalyser` do SDK faz. */
function nivelDe(raias: Uint8Array): number {
  let soma = 0
  for (const amplitude of raias) soma += (amplitude / 255) ** 2
  return Math.sqrt(soma / raias.length)
}

/**
 * "Está saindo som?" — a única pergunta que o áudio da tela deixa sem resposta, já que quem
 * compartilha não se ouve.
 *
 * O nível vai direto ao elemento por variável CSS: passar por `useState` re-renderizaria a sala
 * inteira dez vezes por segundo para mexer numa barrinha.
 */
function SomSaindo({ faixa }: { faixa: MediaStreamTrack }) {
  const barra = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const elemento = barra.current
    if (!elemento) return

    const contexto = new AudioContext()
    const analisador = contexto.createAnalyser()
    // Não é espectro, é nível: poucas raias bastam e custam menos por leitura.
    analisador.fftSize = 256
    analisador.smoothingTimeConstant = 0.6
    contexto.createMediaStreamSource(new MediaStream([faixa])).connect(analisador)
    const raias = new Uint8Array(analisador.frequencyBinCount)

    const relogio = setInterval(() => {
      analisador.getByteFrequencyData(raias)
      elemento.style.setProperty('--nivel', nivelDe(raias).toFixed(2))
    }, 1000 / LEITURAS_POR_SEGUNDO)

    return () => {
      clearInterval(relogio)
      void contexto.close()
    }
  }, [faixa])

  if (!temMedidorDeNivel()) return null
  return <span ref={barra} className={estilos.somSaindo} title="som saindo" style={{ ['--nivel' as string]: '0' }} />
}

/**
 * A barra de baixo. Microfone e câmera começam fechados — ninguém entra numa sala já
 * transmitindo — e o estado de cada um está no próprio botão, não escondido num menu.
 */
export function Controles({
  sala,
  compartilhamento,
  abaAberta,
  aoAlternarAba,
  aoFalhar,
  aoSair,
}: Props) {
  const [mudandoMicrofone, setMudandoMicrofone] = useState(false)
  const [mudandoCamera, setMudandoCamera] = useState(false)

  const audioDaTela = compartilhamento.audioDaTela
  const somDaTelaNoAr = Boolean(audioDaTela && !audioDaTela.isMuted)
  const faixaDoSomDaTela = audioDaTela?.track?.mediaStreamTrack

  const microfoneLigado = sala?.localParticipant.isMicrophoneEnabled ?? false
  const cameraLigada = sala?.localParticipant.isCameraEnabled ?? false

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
        desabilitado={mudandoMicrofone}
        aoClicar={() => void alternarMicrofone()}
      >
        {microfoneLigado ? <IconeMicrofone /> : <IconeMicrofoneMudo />}
      </Botao>

      <Botao
        rotulo={cameraLigada ? 'Fechar câmera' : 'Abrir câmera'}
        ligado={cameraLigada}
        desabilitado={mudandoCamera}
        aoClicar={() => void alternarCamera()}
      >
        {cameraLigada ? <IconeCamera /> : <IconeCameraFechada />}
      </Botao>

      <Botao
        rotulo={compartilhamento.ativo ? 'Parar de compartilhar a tela' : 'Compartilhar tela'}
        ligado={compartilhamento.ativo}
        desabilitado={compartilhamento.ocupado}
        aoClicar={() => void compartilhamento.alternar()}
      >
        <IconeTela />
      </Botao>

      {/* Só faz sentido enquanto há tela no ar: sem transmissão não existe som de tela nenhum. */}
      {compartilhamento.ativo && (
        <>
          <Botao
            rotulo={!audioDaTela ? 'Áudio da tela' : somDaTelaNoAr ? 'Calar o áudio da tela' : 'Devolver o áudio da tela'}
            dica={audioDaTela ? undefined : "marque 'compartilhar áudio' no seletor ao iniciar"}
            ligado={somDaTelaNoAr}
            desabilitado={!audioDaTela}
            aoClicar={() => void compartilhamento.alternarAudioDaTela()}
          >
            {somDaTelaNoAr ? <IconeSom /> : <IconeSomMudo />}
          </Botao>
          {faixaDoSomDaTela && <SomSaindo faixa={faixaDoSomDaTela} />}
        </>
      )}

      <span className={estilos.separador} />

      <Botao rotulo="Qualidade da tela" ligado={abaAberta === 'qualidade'} aoClicar={() => aoAlternarAba('qualidade')}>
        <IconeAjustes />
      </Botao>

      <Botao rotulo="Chat" ligado={abaAberta === 'chat'} aoClicar={() => aoAlternarAba('chat')}>
        <IconeChat />
      </Botao>

      <Botao rotulo="Sair da sala" perigo aoClicar={aoSair}>
        <IconeSair />
      </Botao>
    </div>
  )
}
