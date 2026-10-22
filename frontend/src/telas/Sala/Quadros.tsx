import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ConnectionState } from 'livekit-client'
import { arranjoDaGrade } from '../../sala/grade'
import { comProblemaDeConexao, estadoDoQuadro, type Peca } from '../../sala/palco'
import type { ControleDeVolumes } from '../../sala/useVolumes'
import { Avatar } from '../../ui/Avatar'
import { corDoNome } from '../../ui/avatares'
import { IconeMicrofoneMudo, IconeTelaNoAr } from '../../ui/Icone'
import { ControleDeSom } from './ControleDeSom'
import { Video } from './Midia'
import estilos from './Quadros.module.css'

/** O selo vermelho de quem compartilha — o mesmo na coluna, na grade e no foco. */
export function SeloAoVivo() {
  return <span className={estilos.aoVivo}>Ao vivo</span>
}

function quem(peca: Peca): string {
  if (peca.ehTela) return peca.proprio ? 'a sua tela' : `a tela de ${peca.nome}`
  return peca.proprio ? 'você' : peca.nome
}

function rotuloDaTela(peca: Peca): string {
  return peca.proprio ? 'Sua tela' : `Tela de ${peca.nome}`
}

/** O que o quadro pequeno diz por cima da imagem quando ela não está chegando. */
function fraseCurta(peca: Peca, minhaConexao: ConnectionState): string | null {
  switch (estadoDoQuadro(peca, minhaConexao)) {
    case 'aoVivo':
      return null
    case 'voceReconectando':
      return 'Reconectando…'
    case 'terminou':
      return 'Terminou'
    case 'naoVejo':
      return 'Você deixou de ver'
    case 'donoReconectando':
      return 'Conexão caiu — esperando'
    case 'pausada':
      return 'Pausada'
    case 'chegando':
      return 'Chegando…'
    case 'nuncaChegou':
      return 'Não chegou aqui'
    case 'congelada':
      return 'Imagem parada'
  }
}

interface PropsDoQuadro {
  peca: Peca
  aoEscolher(chave: string): void
  volumes: ControleDeVolumes
  minhaConexao: ConnectionState
  estilo?: CSSProperties
  /** Na faixa do foco: menor, sem volume e com o nome mais curto. */
  pequeno?: boolean
}

/**
 * Um quadro da grade ou da faixa: a Tela (a imagem, o selo "Ao vivo" e o nome) ou a Pessoa (o
 * avatar no meio de um fundo da cor dela, o anel verde quando fala, o microfone fechado e o
 * aviso de conexão ruim). O clique põe o quadro em foco; o volume fica fora do botão.
 */
export function Quadro({ peca, aoEscolher, volumes, minhaConexao, estilo, pequeno = false }: PropsDoQuadro) {
  const problema = comProblemaDeConexao(peca)
  const frase = peca.ehTela ? fraseCurta(peca, minhaConexao) : null
  const fundo = peca.ehTela ? undefined : ({ '--cor-da-pessoa': corDoNome(peca.nome) } as CSSProperties)

  return (
    <div
      className={estilos.quadro}
      data-tipo={peca.ehTela ? 'tela' : 'pessoa'}
      data-falando={(!peca.ehTela && peca.falando) || undefined}
      data-pequeno={pequeno || undefined}
      style={{ ...estilo, ...fundo }}
    >
      <button
        type="button"
        className={estilos.escolher}
        aria-label={`Pôr ${quem(peca)} no palco`}
        title="Pôr em foco"
        onClick={() => aoEscolher(peca.chave)}
      >
        {peca.ehTela ? (
          peca.publicacao && <Video publicacao={peca.publicacao} className={estilos.video} />
        ) : (
          <Avatar nome={peca.nome} tamanho={pequeno ? 40 : 80} />
        )}
      </button>

      {frase && <span className={estilos.frase}>{frase}</span>}

      <span className={estilos.alto}>
        {peca.ehTela && !peca.encerrada && <SeloAoVivo />}
        {problema && (
          <span
            className={estilos.alerta}
            role="img"
            aria-label={`${peca.nome} pode estar com problemas de conexão`}
            title={`${peca.nome} pode estar com problemas para se conectar à sala`}
          >
            !
          </span>
        )}
      </span>

      <span className={estilos.rodape}>
        <span className={estilos.nome}>
          {peca.ehTela && (
            <span className={estilos.iconeDoNome} aria-hidden="true">
              <IconeTelaNoAr tamanho={14} />
            </span>
          )}
          {!peca.ehTela && !peca.microfoneLigado && (
            <span className={estilos.mudo} aria-hidden="true">
              <IconeMicrofoneMudo tamanho={14} />
            </span>
          )}
          <span className={estilos.textoDoNome}>{peca.ehTela ? rotuloDaTela(peca) : peca.nome}</span>
        </span>
        {!pequeno && !peca.proprio && peca.temAudio && <ControleDeSom peca={peca} volumes={volumes} />}
      </span>
    </div>
  )
}

/** A área medida, para a grade caber nela. Sem `ResizeObserver` (jsdom), fica 0 — o CSS decide. */
function useMedida() {
  const ref = useRef<HTMLDivElement>(null)
  const [medida, setMedida] = useState({ largura: 0, altura: 0 })
  useLayoutEffect(() => {
    const alvo = ref.current
    if (!alvo || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(([entrada]) => {
      if (!entrada) return
      setMedida({ largura: entrada.contentRect.width, altura: entrada.contentRect.height })
    })
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [])
  return [ref, medida] as const
}

interface PropsDaGrade {
  pecas: Peca[]
  aoEscolher(chave: string): void
  volumes: ControleDeVolumes
  minhaConexao: ConnectionState
}

/** Todos os quadros do mesmo tamanho, o maior que couber, centrados. */
export function Grade({ pecas, aoEscolher, volumes, minhaConexao }: PropsDaGrade) {
  const [ref, medida] = useMedida()
  const arranjo = arranjoDaGrade(pecas.length, medida.largura, medida.altura)
  const tamanho = arranjo.largura > 0 ? { width: arranjo.largura, height: arranjo.altura } : undefined

  return (
    <div ref={ref} className={estilos.grade} aria-label="Grade da chamada">
      <div className={estilos.quadrosDaGrade} style={tamanho ? { maxWidth: arranjo.colunas * (arranjo.largura + 8) } : undefined}>
        {pecas.map((peca) => (
          <Quadro
            key={peca.chave}
            peca={peca}
            aoEscolher={aoEscolher}
            volumes={volumes}
            minhaConexao={minhaConexao}
            estilo={tamanho}
          />
        ))}
      </div>
    </div>
  )
}

interface PropsDaFaixa extends PropsDaGrade {
  visivel: boolean
}

/** A faixa sob o quadro em foco: os outros quadros, pequenos, numa fileira. */
export function Faixa({ pecas, aoEscolher, volumes, minhaConexao, visivel }: PropsDaFaixa) {
  if (pecas.length === 0) return null
  return (
    <div className={estilos.faixa} data-visivel={visivel || undefined} aria-label="Outros quadros da chamada">
      {pecas.map((peca) => (
        <Quadro
          key={peca.chave}
          peca={peca}
          aoEscolher={aoEscolher}
          volumes={volumes}
          minhaConexao={minhaConexao}
          pequeno
        />
      ))}
    </div>
  )
}
