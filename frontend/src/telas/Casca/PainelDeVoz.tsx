import { useRef, useState } from 'react'
import type { EstadoDaConexao } from '../../sala/estadoDaConexao'
import { IconeConvite, IconeRecarregar, IconeSair, IconeSinal, IconeTela, IconeTelaNoAr } from '../../ui/Icone'
import { Suspenso } from '../../ui/Suspenso'
import estilos from './PainelDeVoz.module.css'

interface Props {
  estado: EstadoDaConexao
  nomeDaSala: string
  /** Leva a página de volta para a chamada (o nome da sala é um link). */
  aoMostrarSala(): void
  aoSair(): void
  compartilhando: boolean
  /** Compartilhar a tela; no ar, leva à barra da chamada, onde mora o menu de quem está no ar. */
  aoAlternarTela(): void
  telaOcupada: boolean
  aoRecarregarMidia(): void
  aoConvidar(): void
  aoVerMetricas(): void
  conectada: boolean
}

/**
 * O painel de voz conectada, acima do painel da pessoa: o estado da conexão em cor (o clique
 * explica), o nome da Sala, o desligar e uma fileira de ações — compartilhar, recarregar a mídia
 * e convidar.
 */
export function PainelDeVoz({
  estado,
  nomeDaSala,
  aoMostrarSala,
  aoSair,
  compartilhando,
  aoAlternarTela,
  telaOcupada,
  aoRecarregarMidia,
  aoConvidar,
  aoVerMetricas,
  conectada,
}: Props) {
  const [explicando, setExplicando] = useState(false)
  const rotulo = useRef<HTMLButtonElement>(null)

  return (
    <section className={estilos.painel} aria-label="Conexão com a sala">
      <div className={estilos.linha}>
        <div className={estilos.estadoENome}>
          <button
            ref={rotulo}
            type="button"
            className={estilos.estado}
            data-tom={estado.tom}
            aria-expanded={explicando}
            onClick={() => setExplicando((valor) => !valor)}
          >
            <span className={estilos.sinal} data-tom={estado.sinal} aria-hidden="true">
              <IconeSinal tamanho={16} />
            </span>
            {estado.rotulo}
          </button>
          <button type="button" className={estilos.nomeDaSala} title="Voltar à chamada" onClick={aoMostrarSala}>
            {nomeDaSala} / janja-share
          </button>
        </div>
        <button type="button" className={estilos.desligar} aria-label="Sair da sala" title="Sair da sala" onClick={aoSair}>
          <IconeSair tamanho={20} />
        </button>
      </div>

      <div className={estilos.acoes}>
        <button
          type="button"
          className={estilos.acao}
          data-ligada={compartilhando || undefined}
          aria-label={compartilhando ? 'Sua tela está no ar' : 'Compartilhar tela'}
          title={compartilhando ? 'Sua tela está no ar — o menu fica na barra da chamada' : 'Compartilhar tela'}
          disabled={telaOcupada || (!compartilhando && !conectada)}
          onClick={aoAlternarTela}
        >
          {compartilhando ? <IconeTelaNoAr tamanho={20} /> : <IconeTela tamanho={20} />}
        </button>
        <button
          type="button"
          className={estilos.acao}
          aria-label="Recarregar mídia"
          title="Recarregar mídia: busca de novo as telas e o som, sem sair da sala"
          disabled={!conectada}
          onClick={aoRecarregarMidia}
        >
          <IconeRecarregar tamanho={20} />
        </button>
        <button type="button" className={estilos.acao} aria-label="Convidar" title="Convidar" onClick={aoConvidar}>
          <IconeConvite tamanho={20} />
        </button>
      </div>

      <Suspenso ancora={rotulo} aberto={explicando} aoFechar={() => setExplicando(false)} rotulo="Estado da conexão" papel="group">
        <div className={estilos.explicacao}>
          <strong className={estilos.tituloDaExplicacao} data-tom={estado.tom}>
            {estado.rotulo}
          </strong>
          <p>{estado.explicacao}</p>
          <p className={estilos.limiares}>
            Atraso acima de 250 ms já se nota no som; perda acima de 10% picota a imagem.
          </p>
          <div className={estilos.botoesDaExplicacao}>
            <button
              type="button"
              className={estilos.link}
              onClick={() => {
                setExplicando(false)
                aoVerMetricas()
              }}
            >
              Ver as métricas
            </button>
            <button
              type="button"
              className={estilos.link}
              disabled={!conectada}
              onClick={() => {
                setExplicando(false)
                aoRecarregarMidia()
              }}
            >
              Recarregar mídia
            </button>
          </div>
        </div>
      </Suspenso>
    </section>
  )
}
