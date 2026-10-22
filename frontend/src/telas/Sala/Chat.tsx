import { useEffect, useRef, useState, type FormEvent } from 'react'
import { abreGrupo, LIMITE_DO_TEXTO } from '../../sala/chat'
import type { Chat as ConversaDaSala } from '../../sala/useChat'
import { Avatar } from '../../ui/Avatar'
import { IconeEnviar } from '../../ui/Icone'
import estilos from './Chat.module.css'

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * O chat de texto da Sala, à direita da chamada. Mensagens do mesmo autor em sequência formam um
 * grupo: só a primeira leva avatar, nome e hora. Sem histórico por decisão de projeto: quem
 * entra vê a sala do jeito que ela está, não o que foi dito antes.
 *
 * A conversa chega por prop porque o `useChat` mora na tela da sala: este painel abre e fecha, e
 * o que foi dito não pode depender de ele estar aberto.
 */
export function Chat({ chat, nomeDaSala = '' }: { chat: ConversaDaSala; nomeDaSala?: string }) {
  const { mensagens, enviar, falhaAoEnviar } = chat
  const [rascunho, setRascunho] = useState('')
  const lista = useRef<HTMLDivElement>(null)

  // Rolagem só do painel do chat: `scrollIntoView` arrastaria a página inteira.
  useEffect(() => {
    const caixa = lista.current
    if (caixa) caixa.scrollTop = caixa.scrollHeight
  }, [mensagens])

  async function submeter(evento: FormEvent) {
    evento.preventDefault()
    const texto = rascunho
    setRascunho('')
    await enviar(texto)
  }

  return (
    <section className={estilos.chat} aria-label="Chat da sala">
      <div className={estilos.lista} role="log" aria-live="polite" ref={lista}>
        {mensagens.length === 0 && (
          <p className={estilos.vazio}>Nada dito ainda. O que for escrito aqui some quando a sala fecha.</p>
        )}
        {mensagens.map((mensagem, indice) => {
          const abre = abreGrupo(mensagens[indice - 1], mensagem)
          return (
            <article key={mensagem.id} className={estilos.mensagem} data-abre-grupo={abre || undefined}>
              {abre ? (
                <>
                  <Avatar nome={mensagem.nome} tamanho={40} className={estilos.avatar} />
                  <h3 className={estilos.linhaDoAutor}>
                    <span className={estilos.autor}>{mensagem.nome}</span>
                    <time className={estilos.hora} dateTime={new Date(mensagem.ts).toISOString()}>
                      {hora(mensagem.ts)}
                    </time>
                  </h3>
                </>
              ) : (
                <time className={estilos.horaAoLado} dateTime={new Date(mensagem.ts).toISOString()}>
                  {hora(mensagem.ts)}
                </time>
              )}
              <p className={estilos.texto}>{mensagem.texto}</p>
            </article>
          )
        })}
      </div>

      {falhaAoEnviar && (
        <p className={estilos.falha} role="alert">
          {falhaAoEnviar}
        </p>
      )}

      <form className={estilos.formulario} onSubmit={submeter}>
        <div className={estilos.caixaDeTexto}>
          <input
            className={estilos.entrada}
            aria-label="Mensagem"
            placeholder={nomeDaSala ? `Conversar em ${nomeDaSala}` : 'Conversar na sala'}
            maxLength={LIMITE_DO_TEXTO}
            value={rascunho}
            onChange={(evento) => setRascunho(evento.target.value)}
          />
          <button
            type="submit"
            className={estilos.enviar}
            aria-label="Enviar"
            title="Enviar"
            disabled={rascunho.trim() === ''}
          >
            <IconeEnviar tamanho={20} />
          </button>
        </div>
      </form>
    </section>
  )
}
