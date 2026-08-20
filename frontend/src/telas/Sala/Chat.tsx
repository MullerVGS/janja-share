import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LIMITE_DO_TEXTO } from '../../sala/chat'
import type { Chat as ConversaDaSala } from '../../sala/useChat'
import estilos from './Chat.module.css'

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Chat lateral efêmero. Sem histórico por decisão de projeto: quem entra vê a sala do jeito que
 * ela está, não o que foi dito antes — e é por isso que o cabeçalho avisa em vez de esconder.
 *
 * A conversa chega por prop porque o `useChat` mora na tela da sala: este painel abre e fecha, e
 * o que foi dito não pode depender de ele estar aberto.
 */
export function Chat({ chat }: { chat: ConversaDaSala }) {
  const { mensagens, enviar, falhaAoEnviar } = chat
  const [rascunho, setRascunho] = useState('')
  const lista = useRef<HTMLDivElement>(null)

  // Rolagem só do painel do chat: `scrollIntoView` arrastaria a página inteira, e a sala não
  // pode se mexer porque alguém escreveu.
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
      <header className={estilos.cabecalho}>
        <h2 className={estilos.titulo}>Chat</h2>
        <span className={estilos.efemero}>some quando a sala fecha</span>
      </header>

      <div className={estilos.lista} role="log" aria-live="polite" ref={lista}>
        {mensagens.length === 0 && <p className={estilos.vazio}>Nada dito ainda.</p>}
        {mensagens.map((mensagem) => (
          <article
            key={mensagem.id}
            className={[estilos.mensagem, mensagem.propria ? estilos.propria : ''].filter(Boolean).join(' ')}
          >
            <div className={estilos.linhaDoAutor}>
              <span className={estilos.autor}>{mensagem.nome}</span>
              <time className={estilos.hora} dateTime={new Date(mensagem.ts).toISOString()}>
                {hora(mensagem.ts)}
              </time>
            </div>
            <p className={estilos.texto}>{mensagem.texto}</p>
          </article>
        ))}
      </div>

      {falhaAoEnviar && (
        <p className={estilos.falha} role="alert">
          {falhaAoEnviar}
        </p>
      )}

      <form className={estilos.formulario} onSubmit={submeter}>
        <input
          className={estilos.entrada}
          aria-label="Mensagem"
          placeholder="escreva algo"
          maxLength={LIMITE_DO_TEXTO}
          value={rascunho}
          onChange={(evento) => setRascunho(evento.target.value)}
        />
        <button type="submit" className={estilos.enviar} disabled={rascunho.trim() === ''}>
          Enviar
        </button>
      </form>
    </section>
  )
}
