import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomEvent, type Room } from 'livekit-client'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { desempacotar, empacotar } from '../src/sala/chat'
import { TOPICO_DO_CHAT, useChat } from '../src/sala/useChat'
import { Chat } from '../src/telas/Sala/Chat'
import { montar } from './apoio/montar'

type Ouvinte = (...argumentos: unknown[]) => void

/**
 * A sala do SDK reduzida ao que o chat usa: assinar `DataReceived` e publicar dados. O SDK de
 * verdade não entra no teste — o que está sob prova é a lógica desta casa (o que sai no fio, o
 * que é aceito do que chega, e em que ordem as mensagens param na tela).
 */
class SalaFalsa {
  ouvintes = new Map<string, Set<Ouvinte>>()
  publicados: { dados: Uint8Array; opcoes?: { reliable?: boolean; topic?: string } }[] = []
  publishData = vi.fn(async (dados: Uint8Array, opcoes?: { reliable?: boolean; topic?: string }) => {
    this.publicados.push({ dados, opcoes })
  })

  localParticipant = { publishData: this.publishData }

  on(evento: string, ouvinte: Ouvinte) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, new Set())
    this.ouvintes.get(evento)?.add(ouvinte)
    return this
  }

  off(evento: string, ouvinte: Ouvinte) {
    this.ouvintes.get(evento)?.delete(ouvinte)
    return this
  }

  /** Simula o que outro participante mandou pelo data channel. */
  receber(payload: unknown, topico: string | undefined = TOPICO_DO_CHAT) {
    const dados =
      payload instanceof Uint8Array ? payload : new TextEncoder().encode(JSON.stringify(payload))
    for (const ouvinte of this.ouvintes.get(RoomEvent.DataReceived) ?? []) {
      ouvinte(dados, undefined, undefined, topico)
    }
  }

  quantosOuvintes() {
    return this.ouvintes.get(RoomEvent.DataReceived)?.size ?? 0
  }
}

/**
 * O arranjo da tela da sala em miniatura: o `useChat` mora fora do painel e a conversa desce por
 * prop, com o painel podendo fechar sem levar o hook junto. É esse arranjo que está sob teste —
 * montar o <Chat> sozinho não teria conversa nenhuma para mostrar.
 */
function PainelDeChat({ sala, nome }: { sala: Room | null; nome: string }) {
  const chat = useChat(sala, nome)
  const [aberto, setAberto] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setAberto((estava) => !estava)}>
        alternar painel
      </button>
      {aberto && <Chat chat={chat} />}
    </>
  )
}

function montarChat(nome = 'Ana') {
  const sala = new SalaFalsa()
  const resultado = montar(<PainelDeChat sala={sala as unknown as Room} nome={nome} />)
  return { sala, resultado }
}

describe('chat da sala', () => {
  it('envia pelo data channel em modo reliable, no tópico do chat, e mostra a própria mensagem', async () => {
    const usuario = userEvent.setup()
    const { sala } = montarChat('Ana')

    await usuario.type(screen.getByLabelText('Mensagem'), '  olha o build quebrado  ')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(sala.publicados).toHaveLength(1))
    const enviado = sala.publicados[0]
    expect(enviado?.opcoes).toEqual({ reliable: true, topic: TOPICO_DO_CHAT })

    const mensagem = desempacotar(enviado?.dados as Uint8Array)
    expect(mensagem?.nome).toBe('Ana')
    expect(mensagem?.texto).toBe('olha o build quebrado')
    expect(typeof mensagem?.ts).toBe('number')

    // `publishData` não ecoa para quem enviou: sem a cópia local, quem escreve não veria nada.
    expect(screen.getByText('olha o build quebrado')).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem')).toHaveValue('')
  })

  it('mostra o que chega de outro participante', async () => {
    const { sala } = montarChat()

    sala.receber({ nome: 'Bia', texto: 'cheguei', ts: Date.now() })

    expect(await screen.findByText('cheguei')).toBeInTheDocument()
    expect(screen.getByText('Bia')).toBeInTheDocument()
  })

  it('ordena por ts, não por ordem de chegada', async () => {
    const { sala } = montarChat()
    const base = new Date('2026-08-20T21:00:00Z').getTime()

    sala.receber({ nome: 'Bia', texto: 'terceira', ts: base + 2000 })
    sala.receber({ nome: 'Caio', texto: 'primeira', ts: base })
    sala.receber({ nome: 'Dan', texto: 'segunda', ts: base + 1000 })

    await screen.findByText('segunda')
    const textos = screen.getAllByRole('article').map((artigo) => artigo.textContent)
    expect(textos.map((texto) => texto?.match(/primeira|segunda|terceira/)?.[0])).toEqual([
      'primeira',
      'segunda',
      'terceira',
    ])
  })

  it('ignora o que não é mensagem de chat', async () => {
    const { sala } = montarChat()

    sala.receber(new TextEncoder().encode('isto não é json'))
    sala.receber({ nome: 'Bia' })
    sala.receber({ nome: 'Bia', texto: '   ' })
    sala.receber({ nome: 'Bia', texto: 'de outro assunto' }, 'telemetria')
    sala.receber({ nome: 'Bia', texto: 'esta vale', ts: Date.now() })

    expect(await screen.findByText('esta vale')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('desassina o data channel ao sair da sala', () => {
    const { sala, resultado } = montarChat()
    expect(sala.quantosOuvintes()).toBe(1)

    resultado.unmount()
    expect(sala.quantosOuvintes()).toBe(0)
  })

  it('fechar e reabrir o painel não perde a conversa nem o ouvinte do data channel', async () => {
    const usuario = userEvent.setup()
    const { sala } = montarChat()
    sala.receber({ nome: 'Bia', texto: 'cheguei', ts: Date.now() })
    expect(await screen.findByText('cheguei')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'alternar painel' }))
    expect(screen.queryByText('cheguei')).not.toBeInTheDocument()
    // O ouvinte continua de pé com o painel fechado: o que é dito enquanto ninguém olha não
    // se perde.
    expect(sala.quantosOuvintes()).toBe(1)
    sala.receber({ nome: 'Bia', texto: 'ainda estou aqui', ts: Date.now() })

    await usuario.click(screen.getByRole('button', { name: 'alternar painel' }))
    expect(await screen.findByText('cheguei')).toBeInTheDocument()
    expect(screen.getByText('ainda estou aqui')).toBeInTheDocument()
  })

  it('avisa quando o envio falha, sem engolir a mensagem escrita', async () => {
    const usuario = userEvent.setup()
    const { sala } = montarChat()
    sala.publishData.mockRejectedValueOnce(new Error('data channel fechado'))

    await usuario.type(screen.getByLabelText('Mensagem'), 'alguém aí?')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('data channel fechado')
    expect(screen.getByText('alguém aí?')).toBeInTheDocument()
  })

  it('o payload no fio é exatamente {nome, texto, ts}', () => {
    const bytes = empacotar({ nome: 'Ana', texto: 'oi', ts: 1_700_000_000_000 })
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
      nome: 'Ana',
      texto: 'oi',
      ts: 1_700_000_000_000,
    })
  })
})
