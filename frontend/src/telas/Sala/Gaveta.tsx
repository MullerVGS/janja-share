import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ABAS, LARGURA_MINIMA_DA_LATERAL, limitarLargura, type Aba } from '../../sala/lateral'
import type { Resumo } from './resumo'
import estilos from './Gaveta.module.css'

interface Props {
  aberta: boolean
  aba: Aba
  aoTrocarAba(aba: Aba): void
  /** A aba de Qualidade só tem o que dizer com tela sua no ar; sem isso ela nem aparece. */
  transmitindo: boolean
  largura: number
  /** Chamado uma vez ao fim do arraste (ou por tecla), com a largura já dentro dos limites. */
  aoRedimensionar(largura: number): void
  naoLidasNoChat: number
  /** A linha de resumo enquanto transmite; `null` esconde a barra. */
  resumo: Resumo | null
  qualidade: ReactNode
  transmissao: ReactNode
  chat: ReactNode
}

const PASSO_DO_TECLADO = 16

/**
 * O painel da direita: resumo da transmissão, abas e o conteúdo ativo.
 *
 * Fica montada mesmo fechada, e o chat fica montado mesmo em outra aba: o rascunho escrito e a
 * rolagem não podem sumir porque a pessoa foi olhar um gráfico. Fechada, sai da árvore de
 * acessibilidade e do caminho do teclado (`inert`) — montada não é o mesmo que alcançável.
 * Qualidade e Transmissão montam só quando visíveis: a Transmissão redesenha a 1 Hz, e não
 * vale pagar isso escondida.
 *
 * A largura anda por variável CSS escrita direto no elemento durante o arraste; o React só
 * fica sabendo quando a pessoa solta. No desktop o painel divide o corpo com o palco; em telas
 * estreitas vira uma camada para não esmagar o conteúdo principal.
 */
export function Gaveta({
  aberta,
  aba,
  aoTrocarAba,
  transmitindo,
  largura,
  aoRedimensionar,
  naoLidasNoChat,
  resumo,
  qualidade,
  transmissao,
  chat,
}: Props) {
  const coluna = useRef<HTMLElement>(null)
  const arrastando = useRef<number | null>(null)

  // A Qualidade só tem o que dizer transmitindo. Quem corrige a aba quando ela some é a `Sala`,
  // que também responde pelo contador de não lidas e pelo botão do chat na barra — duas donas
  // para a mesma aba fariam a gaveta mostrar o chat enquanto a barra jurava que ele estava
  // fechado, e o contador subiria com a pessoa olhando para as mensagens.
  const abas = ABAS.filter((opcao) => opcao.valor !== 'qualidade' || transmitindo)

  function aplicar(pedida: number): number {
    const limitada = limitarLargura(pedida, window.innerWidth)
    coluna.current?.style.setProperty('--largura-da-gaveta', `${limitada}px`)
    return limitada
  }

  function comecarArraste(evento: PointerEvent<HTMLDivElement>) {
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
    arrastando.current = evento.pointerId
  }

  function arrastar(evento: PointerEvent<HTMLDivElement>) {
    if (arrastando.current !== evento.pointerId) return
    // A gaveta encosta na borda direita: a largura é o que sobra da janela à direita do ponteiro.
    aplicar(window.innerWidth - evento.clientX)
  }

  function soltar(evento: PointerEvent<HTMLDivElement>) {
    if (arrastando.current !== evento.pointerId) return
    arrastando.current = null
    evento.currentTarget.releasePointerCapture?.(evento.pointerId)
    aoRedimensionar(aplicar(window.innerWidth - evento.clientX))
  }

  function teclar(evento: KeyboardEvent<HTMLDivElement>) {
    const sentido = evento.key === 'ArrowLeft' ? 1 : evento.key === 'ArrowRight' ? -1 : 0
    if (sentido === 0) return
    evento.preventDefault()
    aoRedimensionar(aplicar(largura + sentido * PASSO_DO_TECLADO))
  }

  return (
    <aside
      ref={coluna}
      className={estilos.gaveta}
      data-aberta={aberta || undefined}
      aria-hidden={aberta ? undefined : true}
      inert={!aberta}
      style={{ ['--largura-da-gaveta' as string]: `${largura}px` }}
    >
      <div
        className={estilos.divisor}
        role="separator"
        aria-orientation="vertical"
        aria-label="Largura do painel"
        aria-valuenow={largura}
        aria-valuemin={LARGURA_MINIMA_DA_LATERAL}
        tabIndex={0}
        onPointerDown={comecarArraste}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onKeyDown={teclar}
      />

      {resumo && (
        <button
          type="button"
          className={estilos.resumo}
          data-tom={resumo.tom}
          aria-label="Resumo da transmissão — abrir detalhes"
          onClick={() => aoTrocarAba('transmissao')}
        >
          <span className={estilos.partesDoResumo}>{resumo.partes.join(' · ')}</span>
          <span className={estilos.separadorDoResumo}> · </span>
          <span className={estilos.estadoDoResumo}>{resumo.estado}</span>
        </button>
      )}

      <div className={estilos.abas} role="tablist" aria-label="Painéis da sala">
        {abas.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            role="tab"
            id={`aba-${opcao.valor}`}
            aria-selected={aba === opcao.valor}
            aria-controls={`painel-${opcao.valor}`}
            className={estilos.aba}
            onClick={() => aoTrocarAba(opcao.valor)}
          >
            {opcao.rotulo}
            {opcao.valor === 'chat' && naoLidasNoChat > 0 && (
              <span className={estilos.contador} aria-label={`${naoLidasNoChat} mensagens não lidas`}>
                {naoLidasNoChat}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === 'qualidade' && (
        <div className={estilos.painel} role="tabpanel" id="painel-qualidade" aria-labelledby="aba-qualidade">
          {qualidade}
        </div>
      )}
      {aba === 'transmissao' && (
        <div className={estilos.painel} role="tabpanel" id="painel-transmissao" aria-labelledby="aba-transmissao">
          {transmissao}
        </div>
      )}
      <div
        className={estilos.painel}
        role="tabpanel"
        id="painel-chat"
        aria-labelledby="aba-chat"
        hidden={aba !== 'chat'}
      >
        {chat}
      </div>
    </aside>
  )
}
