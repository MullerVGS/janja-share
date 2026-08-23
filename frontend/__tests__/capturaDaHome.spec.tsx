import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Track, type LocalTrack, type Room, type TrackPublishOptions } from 'livekit-client'
import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OPCOES_DO_AUDIO_DA_TELA } from '../src/sala/audioDaTela'
import { guardarCaptura, retirarCaptura } from '../src/sala/capturaPendente'
import { Sala } from '../src/telas/Sala/Sala'
import { montar } from './apoio/montar'
import { participanteFalso, salaFalsa, type PublicacaoFalsa } from './apoio/salaFalsa'
import { credenciaisFalsas, guardarSessao } from './apoio/sessaoFalsa'

/**
 * A junta home → sala: as 4 linhas de `Sala.tsx` que pegam a captura que o seletor da home abriu
 * e a entregam ao compartilhamento — mais o efeito irmão que a mata quando a conexão falha.
 *
 * `Inicio.spec` prova que a home deposita a captura e `useCompartilhamento.spec` prova que
 * `adotar` publica; nenhuma das duas exercita o fio entre elas. E este é o defeito que se
 * disfarça de feature: quebrado, ele degrada para o plano B — "a sala abre com o botão de
 * compartilhar em destaque" —, que é indistinguível do comportamento correto de quem cancelou o
 * seletor. Por isso o `useCompartilhamento` aqui é o de verdade, e a asserção é sobre
 * `publishTrack`: nada menos que isso separa "publicou" de "abriu a sala vazia".
 */

const falso = vi.hoisted(() => ({
  conectado: false,
  erro: null as string | null,
  sala: null as Room | null,
}))

vi.mock('../src/sala/useSala', async () => {
  const { ConnectionState } = await import('livekit-client')
  return {
    useSala: () => ({
      sala: falso.sala,
      conexao: falso.conectado ? ConnectionState.Connected : ConnectionState.Connecting,
      erro: falso.erro,
      versao: 0,
      audioLiberado: true,
      liberarAudio() {},
    }),
  }
})

// A telemetria tem relógio próprio a 1 Hz; aqui ela não tem nada a dizer.
vi.mock('../src/telemetria/useTelemetria', async () => {
  const { TELEMETRIA_VAZIA } = await import('../src/telemetria/coletor')
  return { useTelemetria: () => ({ ...TELEMETRIA_VAZIA, rearmarRecepcao: vi.fn() }) }
})

/** Uma faixa de captura reduzida ao que o caminho de `adotar` toca. */
function faixaFalsa(kind: 'video' | 'audio'): LocalTrack {
  return {
    kind,
    mediaStreamTrack: { contentHint: '', applyConstraints: vi.fn(async () => {}) },
    sender: undefined,
    attach: vi.fn(),
    detach: vi.fn(),
    stop: vi.fn(),
  } as unknown as LocalTrack
}

/** Um `Room` que publica de verdade: `publishTrack` registra a publicação que o hook relê. */
function salaQuePublica() {
  const publicacoes: PublicacaoFalsa[] = []
  const publishTrack = vi.fn(async (faixa: LocalTrack, opcoes: TrackPublishOptions) => {
    const publicacao = {
      trackSid: `t${publicacoes.length + 1}`,
      kind: faixa.kind,
      source: opcoes.source ?? Track.Source.ScreenShare,
      isMuted: false,
      track: faixa,
    } as unknown as PublicacaoFalsa
    publicacoes.push(publicacao)
    return publicacao
  })
  const eu = Object.assign(participanteFalso('ana-a1b2c3', 'Ana', publicacoes), { publishTrack })
  return { sala: salaFalsa(eu), publishTrack }
}

function montarSala() {
  const daquiAUmaHora = Date.now() + 60 * 60 * 1000
  guardarSessao(credenciaisFalsas(daquiAUmaHora), daquiAUmaHora)
  return montar(
    <Routes>
      <Route path="/sala/:slug" element={<Cenario />} />
    </Routes>,
    '/sala/share',
  )
}

/** A sala mais o gatilho que a leva de `Connecting` a `Connected`, como o SDK faria. */
function Cenario() {
  const [, reler] = useState(0)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          falso.conectado = true
          reler((n) => n + 1)
        }}
      >
        simular conectado
      </button>
      <Sala />
    </>
  )
}

afterEach(() => {
  falso.conectado = false
  falso.erro = null
  falso.sala = null
  retirarCaptura()
  localStorage.clear()
})

describe('a captura que a home abriu chega à sala', () => {
  it('conectar publica as duas faixas guardadas — o vídeo com as opções do perfil, o áudio com as de mídia', async () => {
    const usuario = userEvent.setup()
    const { sala, publishTrack } = salaQuePublica()
    falso.sala = sala
    const video = faixaFalsa('video')
    const audio = faixaFalsa('audio')
    guardarCaptura([video, audio])
    montarSala()

    // Enquanto a sala não conectou, a captura fica guardada: publicar antes do `Connected`
    // seria publicar num `Room` que ainda não tem para onde mandar.
    expect(publishTrack).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'simular conectado' }))

    await waitFor(() => expect(publishTrack).toHaveBeenCalledTimes(2))
    expect(publishTrack.mock.calls[0]?.[0]).toBe(video)
    expect(publishTrack.mock.calls[0]?.[1]).toMatchObject({
      source: Track.Source.ScreenShare,
      videoCodec: 'vp9',
      scalabilityMode: 'L3T3_KEY',
    })
    expect(publishTrack.mock.calls[1]).toEqual([audio, OPCOES_DO_AUDIO_DA_TELA])
    // A entrega é destrutiva: nada sobra para uma segunda sala retirar.
    expect(retirarCaptura()).toBeNull()
    // E o que foi ao ar continua vivo — parar aqui mataria a transmissão recém-nascida.
    expect(video.stop).not.toHaveBeenCalled()
    expect(audio.stop).not.toHaveBeenCalled()
  })

  it('a barra passa a dizer que você está compartilhando — o clique único da home termina em transmissão', async () => {
    const usuario = userEvent.setup()
    const { sala } = salaQuePublica()
    falso.sala = sala
    guardarCaptura([faixaFalsa('video'), faixaFalsa('audio')])
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'simular conectado' }))

    expect(await screen.findByRole('button', { name: 'Parar de compartilhar a tela' })).toBeInTheDocument()
  })

  it('sem captura guardada nada é publicado — quem cancelou o seletor cai na sala com o botão à mão', async () => {
    const usuario = userEvent.setup()
    const { sala, publishTrack } = salaQuePublica()
    falso.sala = sala
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'simular conectado' }))

    expect(publishTrack).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Compartilhar tela' })).toBeInTheDocument()
  })
})

describe('a captura que a home abriu quando a conexão falha', () => {
  /**
   * Sem o efeito irmão, a sala nunca chega a `Connected`, o efeito de cima nunca roda e a
   * captura só morreria pelo TTL de 30 s — meio minuto com o indicador do Chrome aceso e
   * ninguém do outro lado.
   */
  it('erro de conexão retira a captura e para as faixas na hora', async () => {
    const { sala, publishTrack } = salaQuePublica()
    falso.sala = sala
    falso.erro = 'SFU inalcançável'
    const video = faixaFalsa('video')
    const audio = faixaFalsa('audio')
    guardarCaptura([video, audio])

    montarSala()

    await waitFor(() => expect(video.stop).toHaveBeenCalled())
    expect(audio.stop).toHaveBeenCalled()
    expect(retirarCaptura()).toBeNull()
    expect(publishTrack).not.toHaveBeenCalled()
  })
})
