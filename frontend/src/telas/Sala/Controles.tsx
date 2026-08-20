import { useState, type ReactNode } from 'react'
import type { Room } from 'livekit-client'
import type { Compartilhamento } from '../../sala/useCompartilhamento'
import {
  IconeAjustes,
  IconeCamera,
  IconeCameraFechada,
  IconeChat,
  IconeMicrofone,
  IconeMicrofoneMudo,
  IconeSair,
  IconeTela,
} from '../../ui/Icone'
import estilos from './Controles.module.css'

interface Props {
  sala: Room | null
  compartilhamento: Compartilhamento
  chatAberto: boolean
  painelAberto: boolean
  alternarChat(): void
  alternarPainel(): void
  aoSair(): void
}

function Botao({
  rotulo,
  ligado,
  perigo = false,
  ocupado = false,
  aoClicar,
  children,
}: {
  rotulo: string
  ligado?: boolean
  perigo?: boolean
  ocupado?: boolean
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
      disabled={ocupado}
      onClick={aoClicar}
    >
      {children}
    </button>
  )
}

/**
 * A barra de baixo. Microfone e câmera começam fechados — ninguém entra numa sala já
 * transmitindo — e o estado de cada um está no próprio botão, não escondido num menu.
 */
export function Controles({
  sala,
  compartilhamento,
  chatAberto,
  painelAberto,
  alternarChat,
  alternarPainel,
  aoSair,
}: Props) {
  const [mudandoMicrofone, setMudandoMicrofone] = useState(false)
  const [mudandoCamera, setMudandoCamera] = useState(false)

  const microfoneLigado = sala?.localParticipant.isMicrophoneEnabled ?? false
  const cameraLigada = sala?.localParticipant.isCameraEnabled ?? false

  async function alternarMicrofone() {
    if (!sala) return
    setMudandoMicrofone(true)
    try {
      await sala.localParticipant.setMicrophoneEnabled(!microfoneLigado)
    } finally {
      setMudandoMicrofone(false)
    }
  }

  async function alternarCamera() {
    if (!sala) return
    setMudandoCamera(true)
    try {
      await sala.localParticipant.setCameraEnabled(!cameraLigada)
    } finally {
      setMudandoCamera(false)
    }
  }

  return (
    <div className={estilos.barra}>
      <Botao
        rotulo={microfoneLigado ? 'Fechar microfone' : 'Abrir microfone'}
        ligado={microfoneLigado}
        ocupado={mudandoMicrofone}
        aoClicar={() => void alternarMicrofone()}
      >
        {microfoneLigado ? <IconeMicrofone /> : <IconeMicrofoneMudo />}
      </Botao>

      <Botao
        rotulo={cameraLigada ? 'Fechar câmera' : 'Abrir câmera'}
        ligado={cameraLigada}
        ocupado={mudandoCamera}
        aoClicar={() => void alternarCamera()}
      >
        {cameraLigada ? <IconeCamera /> : <IconeCameraFechada />}
      </Botao>

      <Botao
        rotulo={compartilhamento.ativo ? 'Parar de compartilhar a tela' : 'Compartilhar tela'}
        ligado={compartilhamento.ativo}
        ocupado={compartilhamento.ocupado}
        aoClicar={() => void compartilhamento.alternar()}
      >
        <IconeTela />
      </Botao>

      <span className={estilos.separador} />

      <Botao rotulo="Qualidade da tela" ligado={painelAberto} aoClicar={alternarPainel}>
        <IconeAjustes />
      </Botao>

      <Botao rotulo="Chat" ligado={chatAberto} aoClicar={alternarChat}>
        <IconeChat />
      </Botao>

      <Botao rotulo="Sair da sala" perigo aoClicar={aoSair}>
        <IconeSair />
      </Botao>
    </div>
  )
}
