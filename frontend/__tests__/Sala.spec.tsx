import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Track, type Room } from 'livekit-client'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DAS_PREFERENCIAS, lerPreferencias } from '../src/preferencias'
import { Sala } from '../src/telas/Sala/Sala'
import { montar } from './apoio/montar'
import { participanteFalso, publicacaoFalsa, salaFalsa } from './apoio/salaFalsa'
import { credenciaisFalsas, guardarSessao } from './apoio/sessaoFalsa'

/** O que os hooks do SDK devolvem; o teste mexe aqui e re-renderiza. */
const falso = vi.hoisted(() => ({ compartilhando: false, sala: null as Room | null }))

vi.mock('../src/sala/useSala', async () => {
  const { ConnectionState } = await import('livekit-client')
  return {
    useSala: () => ({
      sala: falso.sala,
      conexao: ConnectionState.Disconnected,
      erro: null,
      versao: 0,
      audioLiberado: true,
      liberarAudio() {},
    }),
  }
})

// A telemetria tem relógio próprio a 1 Hz; nestes testes ela não tem nada a dizer.
vi.mock('../src/telemetria/useTelemetria', async () => {
  const { TELEMETRIA_VAZIA } = await import('../src/telemetria/coletor')
  return { useTelemetria: () => TELEMETRIA_VAZIA }
})

vi.mock('../src/sala/useCompartilhamento', async () => {
  const { compartilhamentoFalso } = await import('./apoio/compartilhamentoFalso')
  return { useCompartilhamento: () => compartilhamentoFalso({ ativo: falso.compartilhando }) }
})

/** A sala mais um botão que "começa a compartilhar": vira o hook falso e re-renderiza a árvore. */
function Cenario() {
  const [, reler] = useState(0)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          falso.compartilhando = true
          reler((n) => n + 1)
        }}
      >
        simular compartilhar
      </button>
      <Sala />
    </>
  )
}

function montarSala() {
  const daquiAUmaHora = Date.now() + 60 * 60 * 1000
  guardarSessao(credenciaisFalsas(daquiAUmaHora), daquiAUmaHora)
  return montar(<Cenario />, '/sala')
}

afterEach(() => {
  falso.compartilhando = false
  falso.sala = null
  localStorage.clear()
})

describe('sala: lateral e preferências', () => {
  it('abre na aba guardada; começar a compartilhar mostra Qualidade sem sobrescrever a escolha da pessoa', async () => {
    const usuario = userEvent.setup()
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, larguraDaLateral: 380, abaDaLateral: 'transmissao' }))
    montarSala()
    expect(screen.getByRole('tab', { name: 'Transmissão' })).toHaveAttribute('aria-selected', 'true')

    await usuario.click(screen.getByRole('button', { name: 'simular compartilhar' }))

    expect(screen.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true')
    expect(lerPreferencias().abaDaLateral).toBe('transmissao')
  })

  it('clicar numa aba é escolha: persiste', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('tab', { name: 'Transmissão' }))
    expect(screen.getByRole('tab', { name: 'Transmissão' })).toHaveAttribute('aria-selected', 'true')
    expect(lerPreferencias().abaDaLateral).toBe('transmissao')
  })

  it('o botão da barra abre a aba e persiste; de novo na mesma aba, fecha a lateral', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Qualidade da tela' }))
    expect(screen.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true')
    expect(lerPreferencias().abaDaLateral).toBe('qualidade')

    await usuario.click(screen.getByRole('button', { name: 'Qualidade da tela' }))
    expect(screen.getByRole('complementary', { hidden: true })).not.toBeVisible()
  })
})

describe('sala: volume local ponta a ponta', () => {
  it('o volume mexido no quadro chega à faixa remota e fica guardado por nome', () => {
    const somDaTela = publicacaoFalsa(Track.Source.ScreenShareAudio)
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare), somDaTela])
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    montarSala()

    expect(somDaTela.track?.setVolume).toHaveBeenLastCalledWith(1)

    fireEvent.change(screen.getByRole('slider', { name: 'Volume da tela de Bia' }), { target: { value: '30' } })

    expect(somDaTela.track?.setVolume).toHaveBeenLastCalledWith(0.3)
    expect(lerPreferencias().volumes).toEqual({ Bia: { tela: 30 } })
  })
})
