import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomEvent, Track, type Room } from 'livekit-client'
import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DAS_PREFERENCIAS, gravarPreferencias, lerPreferencias } from '../src/preferencias'
import { Sala } from '../src/telas/Sala/Sala'
import { empacotar } from '../src/sala/chat'
import { TOPICO_DO_CHAT } from '../src/sala/useChat'
import { CHAVE_DA_SESSAO } from '../src/sessao/sessao'
import { montar } from './apoio/montar'
import { emitirNaSala, participanteFalso, publicacaoFalsa, salaFalsa } from './apoio/salaFalsa'
import { credenciaisFalsas, guardarSessao } from './apoio/sessaoFalsa'
import { chamadas, servir } from './apoio/servidorFalso'

/** O que os hooks do SDK devolvem; o teste mexe aqui e re-renderiza. */
const falso = vi.hoisted(() => ({ compartilhando: false, trocandoTela: false, sala: null as Room | null, versao: 0 }))

vi.mock('../src/sala/useSala', async () => {
  const { ConnectionState } = await import('livekit-client')
  return {
    useSala: () => ({
      sala: falso.sala,
      conexao: ConnectionState.Connected,
      erro: null,
      versao: falso.versao,
      audioLiberado: true,
      liberarAudio() {},
    }),
  }
})

// A telemetria tem relógio próprio a 1 Hz; nestes testes ela não tem nada a dizer.
vi.mock('../src/telemetria/useTelemetria', async () => {
  const { TELEMETRIA_VAZIA } = await import('../src/telemetria/coletor')
  return { useTelemetria: () => ({ ...TELEMETRIA_VAZIA, rearmarRecepcao: vi.fn() }) }
})

vi.mock('../src/sala/useCompartilhamento', async () => {
  const { compartilhamentoFalso } = await import('./apoio/compartilhamentoFalso')
  return { useCompartilhamento: () => compartilhamentoFalso({ ativo: falso.compartilhando, trocandoTela: falso.trocandoTela }) }
})

/**
 * A sala mais dois gatilhos: "simular compartilhar" vira o hook falso, e "mexer no palco" é o
 * que a `versao` do `useSala` faz na sala de verdade quando o SDK muda alguma coisa.
 */
function Cenario() {
  const [, reler] = useState(0)
  const mexer = () => {
    falso.versao += 1
    reler((n) => n + 1)
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          falso.compartilhando = true
          mexer()
        }}
      >
        simular compartilhar
      </button>
      <button
        type="button"
        onClick={() => {
          falso.compartilhando = false
          mexer()
        }}
      >
        simular parar
      </button>
      <button type="button" onClick={mexer}>
        mexer no palco
      </button>
      <Sala />
    </>
  )
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

/** O palco: `data-modo` diz se ele está em foco (uma peça só) ou na grade. */
function palcoDe(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-modo]') as HTMLElement
}

function gaveta() {
  return screen.getByRole('complementary', { hidden: true })
}

afterEach(() => {
  falso.compartilhando = false
  falso.trocandoTela = false
  falso.sala = null
  falso.versao = 0
  localStorage.clear()
})

describe('sala: a gaveta e as preferências', () => {
  it('nasce fechada — palco puro — e o botão do painel a abre na aba guardada', async () => {
    const usuario = userEvent.setup()
    localStorage.setItem(
      CHAVE_DAS_PREFERENCIAS,
      JSON.stringify({ versao: 1, larguraDaLateral: 380, abaDaLateral: 'transmissao' }),
    )
    montarSala()
    expect(gaveta()).toHaveAttribute('aria-hidden', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Abrir o painel' }))

    expect(gaveta()).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('tab', { name: 'Transmissão' })).toHaveAttribute('aria-selected', 'true')
  })

  it('começar a compartilhar mostra Qualidade sem sobrescrever a escolha da pessoa', async () => {
    const usuario = userEvent.setup()
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, abaDaLateral: 'transmissao' }))
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'simular compartilhar' }))

    expect(screen.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true')
    expect(lerPreferencias().abaDaLateral).toBe('transmissao')
  })

  it('clicar numa aba é escolha: persiste', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Abrir o painel' }))
    await usuario.click(screen.getByRole('tab', { name: 'Transmissão' }))

    expect(screen.getByRole('tab', { name: 'Transmissão' })).toHaveAttribute('aria-selected', 'true')
    expect(lerPreferencias().abaDaLateral).toBe('transmissao')
  })

  it('parar de compartilhar leva a aba de Qualidade junto, e a sala inteira enxerga a mesma aba', async () => {
    const usuario = userEvent.setup()
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'))
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'simular compartilhar' }))
    expect(screen.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true')

    await usuario.click(screen.getByRole('button', { name: 'simular parar' }))

    expect(screen.queryByRole('tab', { name: 'Qualidade' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveAttribute('aria-selected', 'true')
    // A barra tem de concordar com a gaveta: o chat está à mostra.
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true')

    // E, com o chat à mostra, mensagem que chega já nasce lida — nada de contador mentiroso.
    act(() => {
      emitirNaSala(
        falso.sala as Room,
        RoomEvent.DataReceived,
        empacotar({ nome: 'Bia', texto: 'oi', ts: Date.now() }),
        undefined,
        undefined,
        TOPICO_DO_CHAT,
      )
    })

    expect(screen.getByText('oi')).toBeInTheDocument()
    expect(screen.queryByLabelText(/não lidas/)).not.toBeInTheDocument()

    // E o botão da barra fecha a gaveta: ele e ela falam da mesma aba.
    await usuario.click(screen.getByRole('button', { name: 'Chat' }))
    expect(gaveta()).toHaveAttribute('aria-hidden', 'true')
  })

  it('o botão da barra abre a gaveta no chat e persiste; de novo, fecha', async () => {
    const usuario = userEvent.setup()
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: 1, abaDaLateral: 'transmissao' }))
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Chat' }))
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveAttribute('aria-selected', 'true')
    expect(lerPreferencias().abaDaLateral).toBe('chat')

    await usuario.click(screen.getByRole('button', { name: 'Chat' }))
    expect(gaveta()).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('sala: volume local ponta a ponta', () => {
  it('o volume mexido no controle da tela chega à faixa remota e fica guardado por nome', () => {
    const somDaTela = publicacaoFalsa(Track.Source.ScreenShareAudio)
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare), somDaTela])
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    montarSala()

    expect(somDaTela.track?.setVolume).toHaveBeenLastCalledWith(1)

    fireEvent.change(screen.getByRole('slider', { name: 'Volume do som da tela de Bia' }), { target: { value: '30' } })

    expect(somDaTela.track?.setVolume).toHaveBeenLastCalledWith(0.3)
    expect(lerPreferencias().volumes).toEqual({ Bia: { tela: 30 } })
  })
})

describe('sala: o palco', () => {
  /** A minha tela e a da Bia no ar; devolve a publicação da minha, para o teste do mudo. */
  function comDuasTelas() {
    const minhaTela = publicacaoFalsa(Track.Source.ScreenShare)
    const eu = participanteFalso('ana-a1b2c3', 'Ana', [minhaTela])
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(eu, [bia])
    return minhaTela
  }

  it('entrar cai em foco na primeira tela no ar; quem sobra vai para a tira', () => {
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    const { container } = montarSala()

    expect(palcoDe(container)).toHaveAttribute('data-modo', 'foco')
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')
    expect(screen.getByRole('button', { name: 'Pôr você no palco' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pôr Bia no palco' })).toBeInTheDocument()
  })

  it('sem tela nenhuma no ar, o palco é a grade com todo mundo', () => {
    const bia = participanteFalso('bia-x1y2', 'Bia')
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    const { container } = montarSala()

    expect(palcoDe(container)).toHaveAttribute('data-modo', 'grade')
    expect(palcoDe(container)).toHaveTextContent('Bia')
    expect(palcoDe(container)).toHaveTextContent('Ana (você)')
  })

  it('clicar na imagem em foco solta o foco e devolve a grade com tudo', async () => {
    const usuario = userEvent.setup()
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    const { container } = montarSala()

    await usuario.click(container.querySelector('[data-imagem]') as HTMLElement)

    await waitFor(() => expect(palcoDe(container)).toHaveAttribute('data-modo', 'grade'))
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')
    expect(palcoDe(container)).toHaveTextContent('Ana (você)')
  })

  it('a tira promove ao palco quem foi clicado', async () => {
    const usuario = userEvent.setup()
    comDuasTelas()
    const { container } = montarSala()
    // Compartilhar põe você no palco: é a exceção da tela própria que `decidirFoco` garante.
    expect(palcoDe(container)).toHaveTextContent('Ana (você) · tela')

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))

    expect(palcoDe(container)).toHaveTextContent('Bia · tela')
  })

  it('mutar e desmutar a própria tela não arranca o foco de quem escolheu assistir outra', async () => {
    const usuario = userEvent.setup()
    const minhaTela = comDuasTelas()
    const { container } = montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')

    // O navegador pausa a captura e a devolve: a chave sai e volta do palco, sem ser tela nova.
    minhaTela.isMuted = true
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' }))
    minhaTela.isMuted = false
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' }))

    expect(palcoDe(container)).toHaveTextContent('Bia · tela')
  })

  it('trocar de tela não arranca o foco de quem escolheu assistir outra', async () => {
    const usuario = userEvent.setup()
    const minhaTela = publicacaoFalsa(Track.Source.ScreenShare)
    // Array próprio (não literal inline): `trocarDeTela` de verdade despublica e republica a
    // mesma fonte — para simular isso é preciso poder remover e devolver a publicação por fora.
    const publicacoesDoEu = [minhaTela]
    const eu = participanteFalso('ana-a1b2c3', 'Ana', publicacoesDoEu)
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(eu, [bia])
    const { container } = montarSala()
    expect(palcoDe(container)).toHaveTextContent('Ana (você) · tela')

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')

    // A partir daqui simula o vaivém interno de `trocarDeTela` (useCompartilhamento.ts): a
    // própria tela some e volta da lista de publicadas enquanto `trocandoTela` é true.
    falso.trocandoTela = true
    publicacoesDoEu.length = 0
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' })) // a tela some
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')

    publicacoesDoEu.push(minhaTela)
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' })) // a tela volta
    // Sem a guarda de `trocandoTela`, a heurística de "tela própria nova" (foco.ts) roubaria o
    // foco de volta aqui — é exatamente o que este teste prova que não acontece.
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')

    falso.trocandoTela = false
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' })) // troca termina
    expect(palcoDe(container)).toHaveTextContent('Bia · tela')
  })
})

describe('sala: a interface que se esconde', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function flutuante(container: HTMLElement): HTMLElement {
    return container.querySelector('[data-interface]') as HTMLElement
  }

  it('some depois de 2,5 s de mouse parado e volta ao primeiro movimento', () => {
    const { container } = montarSala()
    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')

    act(() => vi.advanceTimersByTime(2500))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'oculta')

    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')
  })

  it('com a gaveta aberta, nunca some', () => {
    const { container } = montarSala()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o painel' }))

    act(() => vi.advanceTimersByTime(10_000))

    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')
  })

  it('clicar num botão com o mouse não a trava acesa — foco de mouse não é foco de teclado', () => {
    const { container } = montarSala()
    const botao = screen.getByRole('button', { name: 'Abrir microfone' })

    fireEvent.pointerDown(botao)
    act(() => botao.focus())
    fireEvent.click(botao)

    act(() => vi.advanceTimersByTime(2500))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'oculta')
  })

  it('o teclado dentro dela trava; e destrava quando o botão focado some do DOM', () => {
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    const { container } = montarSala()

    fireEvent.keyDown(document, { key: 'Tab' })
    const miniatura = screen.getByRole('button', { name: 'Pôr você no palco' })
    act(() => miniatura.focus())

    act(() => vi.advanceTimersByTime(10_000))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')

    // Apertar a miniatura promove a peça e tira o próprio botão do DOM. O Chrome não emite
    // `focusout` para elemento focado que sai, e sem reconferir a interface ficaria acesa.
    fireEvent.click(miniatura)

    act(() => vi.advanceTimersByTime(2500))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'oculta')
  })
})

describe('sala: sem credenciais para o slug', () => {
  it('quem abre um link privado informa nome e senha, guarda a sessão e entra', async () => {
    const daquiAUmaHora = Date.now() + 60 * 60 * 1000
    const credenciais = credenciaisFalsas(daquiAUmaHora, 'Ana', 'privada')
    credenciais.nomeDaSala = 'Privada'
    servir({
      'POST /api/salas/privada/entrar': { status: 200, corpo: credenciais },
    })
    const usuario = userEvent.setup()

    montar(
      <Routes>
        <Route path="/sala/:slug" element={<Sala />} />
        <Route path="/" element={<div>início</div>} />
      </Routes>,
      '/sala/privada',
    )

    const dialogo = screen.getByRole('dialog', { name: 'Entrar na sala' })
    await usuario.type(within(dialogo).getByLabelText('Seu nome'), 'Ana')
    await usuario.type(within(dialogo).getByLabelText('Senha (opcional)'), 'segredo')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('region', { name: 'Sala Privada' })).toBeInTheDocument()
    const entrada = chamadas.find((chamada) => chamada.caminho === '/api/salas/privada/entrar')
    expect(entrada?.corpo).toEqual({ seuNome: 'Ana', senha: 'segredo' })
    expect(lerPreferencias().nome).toBe('Ana')
  })

  it('senha errada mantém a porta aberta para corrigir', async () => {
    gravarPreferencias({ nome: 'Ana' })
    servir({
      'POST /api/salas/privada/entrar': { status: 401, corpo: { erro: 'senha_incorreta' } },
    })
    const usuario = userEvent.setup()
    montar(
      <Routes>
        <Route path="/sala/:slug" element={<Sala />} />
      </Routes>,
      '/sala/privada',
    )

    await usuario.type(screen.getByLabelText('Senha (opcional)'), 'errada')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.')
    expect(screen.getByRole('dialog', { name: 'Entrar na sala' })).toBeInTheDocument()
  })

  it('fechar durante a requisição ignora a resposta tardia e não guarda a sessão', async () => {
    const daquiAUmaHora = Date.now() + 60 * 60 * 1000
    const credenciais = credenciaisFalsas(daquiAUmaHora, 'Nova', 'privada')
    let responder!: (resposta: { status: number; corpo: unknown }) => void
    const pendente = new Promise<{ status: number; corpo: unknown }>((resolve) => {
      responder = resolve
    })
    gravarPreferencias({ nome: 'Antiga' })
    servir({ 'POST /api/salas/privada/entrar': () => pendente })
    const usuario = userEvent.setup()
    montar(
      <Routes>
        <Route path="/sala/:slug" element={<Sala />} />
        <Route path="/" element={<div>início</div>} />
      </Routes>,
      '/sala/privada',
    )

    const nome = screen.getByLabelText('Seu nome')
    await usuario.clear(nome)
    await usuario.type(nome, 'Nova')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.getByText('início')).toBeInTheDocument()

    await act(async () => {
      responder({ status: 200, corpo: credenciais })
      await pendente
    })

    expect(lerPreferencias().nome).toBe('Antiga')
    expect(sessionStorage.getItem(CHAVE_DA_SESSAO)).toBeNull()
  })

  it('sessão guardada para outro slug não vaza para esta sala', () => {
    const daquiAUmaHora = Date.now() + 60 * 60 * 1000
    guardarSessao(credenciaisFalsas(daquiAUmaHora, 'Ana', 'outra-sala'), daquiAUmaHora)

    montar(
      <Routes>
        <Route path="/sala/:slug" element={<Sala />} />
        <Route path="/" element={<div>início</div>} />
      </Routes>,
      '/sala/share',
    )

    expect(screen.getByRole('dialog', { name: 'Entrar na sala' })).toBeInTheDocument()
    expect(screen.getByText('#share')).toBeInTheDocument()
  })
})
