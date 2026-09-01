import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomEvent, Track, type Room } from 'livekit-client'
import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gravarPreferencias, lerPreferencias } from '../src/preferencias'
import { Sala } from '../src/telas/Sala/Sala'
import { empacotar } from '../src/sala/chat'
import { TOPICO_DO_CHAT } from '../src/sala/useChat'
import { CHAVE_DA_SESSAO } from '../src/sessao/sessao'
import { montar } from './apoio/montar'
import { emitirNaSala, participanteFalso, publicacaoFalsa, salaFalsa } from './apoio/salaFalsa'
import { credenciaisFalsas, guardarSessao } from './apoio/sessaoFalsa'
import { chamadas, servir } from './apoio/servidorFalso'

/** O que os hooks do SDK devolvem; o teste mexe aqui e re-renderiza. */
const falso = vi.hoisted(() => ({
  compartilhando: false,
  trocandoTela: false,
  sala: null as Room | null,
  versao: 0,
  queda: null as { tentativa: number } | null,
}))

vi.mock('../src/sala/useSala', async () => {
  const { ConnectionState } = await import('livekit-client')
  return {
    useSala: () => ({
      sala: falso.sala,
      conexao: ConnectionState.Connected,
      erro: null,
      queda: falso.queda,
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

/** O palco: `data-modo` diz se há um quadro em destaque ou se não há imagem nenhuma no ar. */
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
  falso.queda = null
  localStorage.clear()
})

describe('sala: a gaveta', () => {
  it('nasce fechada — palco puro — e o botão de conversa do topo a abre', async () => {
    const usuario = userEvent.setup()
    montarSala()
    expect(gaveta()).toHaveAttribute('aria-hidden', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Conversa' }))

    expect(gaveta()).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('tab', { name: /Conversa/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('cada porta nomeia a sua aba: as Métricas abrem nas Métricas', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Métricas da transmissão' }))

    expect(screen.getByRole('tab', { name: 'Métricas' })).toHaveAttribute('aria-selected', 'true')
    // E o botão que a abriu concorda com o que ela desenha.
    expect(screen.getByRole('button', { name: 'Métricas da transmissão' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('começar a compartilhar mostra Qualidade', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'simular compartilhar' }))

    expect(screen.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true')
  })

  it('parar de compartilhar leva a aba de Qualidade junto, e a sala inteira enxerga a mesma aba', async () => {
    const usuario = userEvent.setup()
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'))
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'simular compartilhar' }))
    expect(screen.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true')

    await usuario.click(screen.getByRole('button', { name: 'simular parar' }))

    expect(screen.queryByRole('tab', { name: 'Qualidade' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Conversa/ })).toHaveAttribute('aria-selected', 'true')
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

  it('o botão da barra abre a gaveta no chat; de novo, fecha', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Chat' }))
    expect(screen.getByRole('tab', { name: /Conversa/ })).toHaveAttribute('aria-selected', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Chat' }))
    expect(gaveta()).toHaveAttribute('aria-hidden', 'true')
  })

  it('o X da gaveta a fecha sem trocar de aba', async () => {
    const usuario = userEvent.setup()
    montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Métricas da transmissão' }))
    await usuario.click(screen.getByRole('button', { name: 'Fechar painel' }))

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

  it('entrar põe a primeira tela no ar em destaque; quem sobra vai para as miniaturas', () => {
    comDuasTelas()
    const { container } = montarSala()

    // Compartilhar põe você no palco: é a exceção da tela própria que `decidirFoco` garante.
    expect(palcoDe(container)).toHaveAttribute('data-modo', 'destaque')
    expect(palcoDe(container)).toHaveTextContent('Sua tela')
    expect(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' })).toBeInTheDocument()
  })

  it('sem imagem nenhuma no ar, o palco diz isso — e as pessoas estão na faixa de avatares', () => {
    const bia = participanteFalso('bia-x1y2', 'Bia')
    falso.sala = salaFalsa(participanteFalso('ana-a1b2c3', 'Ana'), [bia])
    const { container } = montarSala()

    expect(palcoDe(container)).toHaveAttribute('data-modo', 'vazio')
    expect(screen.getByText('Nada no ar ainda.')).toBeInTheDocument()
    // Presença vive na pílula do alto, não em retângulos do tamanho de uma tela.
    const faixa = screen.getByLabelText('2 na sala')
    expect(within(faixa).getByTitle('Ana (você) · mudo')).toBeInTheDocument()
    expect(within(faixa).getByTitle('Bia · mudo')).toBeInTheDocument()
  })

  it('um clique na imagem entra na imersão: somem a barra lateral e as miniaturas', async () => {
    const usuario = userEvent.setup()
    comDuasTelas()
    const { container } = montarSala()
    expect(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' })).toBeInTheDocument()

    await usuario.click(container.querySelector('[data-imagem]') as HTMLElement)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Pôr a tela de Bia no palco' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('navigation', { hidden: true })).not.toHaveAttribute('data-aberta')
    // A moldura apaga na hora, etiqueta do quadro inclusive — e a imagem, que é o ponto da
    // imersão, continua lá.
    expect(palcoDe(container)).not.toHaveTextContent('Sua tela')
    expect(container.querySelector('[data-imagem]')).toBeInTheDocument()
  })

  it('na imersão o topo entra na camada que some: apaga no clique e volta ao mover o ponteiro', async () => {
    const usuario = userEvent.setup()
    comDuasTelas()
    const { container } = montarSala()
    // O topo só está "na camada" quando tem um contêiner de auto-ocultar acima dele.
    const topo = () =>
      screen.getByRole('button', { name: 'Pessoas e telas' }).closest<HTMLElement>('[data-interface]')
    expect(topo()).toBeNull()

    await usuario.click(container.querySelector('[data-imagem]') as HTMLElement)

    // Sem esperar relógio nenhum: o clique que pede a tela inteira apaga a moldura na hora.
    await waitFor(() => expect(topo()).toHaveAttribute('data-interface', 'oculta'))
    // E deixou a coluna: agora mora dentro do palco, que ficou com a altura toda.
    expect(screen.getByRole('main', { name: 'Palco da sala' })).toContainElement(topo())

    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(topo()).toHaveAttribute('data-interface', 'visivel')

    await usuario.click(container.querySelector('[data-imagem]') as HTMLElement)
    await waitFor(() => expect(topo()).toBeNull())
  })

  it('abrir a barra lateral sai da imersão', async () => {
    const usuario = userEvent.setup()
    comDuasTelas()
    const { container } = montarSala()

    await usuario.click(container.querySelector('[data-imagem]') as HTMLElement)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Pôr a tela de Bia no palco' })).not.toBeInTheDocument(),
    )

    // Na imersão o topo está apagado e não recebe ponteiro; mover o mouse é o que o traz de volta.
    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    await usuario.click(screen.getByRole('button', { name: 'Pessoas e telas' }))

    expect(screen.getByRole('navigation')).toHaveAttribute('data-aberta')
    expect(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' })).toBeInTheDocument()
  })

  it('a miniatura promove ao destaque quem foi clicado', async () => {
    const usuario = userEvent.setup()
    comDuasTelas()
    const { container } = montarSala()
    expect(palcoDe(container)).toHaveTextContent('Sua tela')

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))

    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')
  })

  it('a linha da barra lateral também põe a tela no palco', async () => {
    const usuario = userEvent.setup()
    comDuasTelas()
    const { container } = montarSala()

    const navegacao = screen.getByRole('navigation', { name: 'Pessoas e telas da sala' })
    await usuario.click(within(navegacao).getByRole('button', { name: /Tela de Bia/ }))

    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')
  })

  it('mutar e desmutar a própria tela não arranca o destaque de quem escolheu assistir outra', async () => {
    const usuario = userEvent.setup()
    const minhaTela = comDuasTelas()
    const { container } = montarSala()

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')

    // O navegador pausa a captura e a devolve: a chave sai e volta do palco, sem ser tela nova.
    minhaTela.isMuted = true
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' }))
    minhaTela.isMuted = false
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' }))

    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')
  })

  it('trocar de tela não arranca o destaque de quem escolheu assistir outra', async () => {
    const usuario = userEvent.setup()
    const minhaTela = publicacaoFalsa(Track.Source.ScreenShare)
    // Array próprio (não literal inline): `trocarDeTela` de verdade despublica e republica a
    // mesma fonte — para simular isso é preciso poder remover e devolver a publicação por fora.
    const publicacoesDoEu = [minhaTela]
    const eu = participanteFalso('ana-a1b2c3', 'Ana', publicacoesDoEu)
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(eu, [bia])
    const { container } = montarSala()
    expect(palcoDe(container)).toHaveTextContent('Sua tela')

    await usuario.click(screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' }))
    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')

    // A partir daqui simula o vaivém interno de `trocarDeTela` (useCompartilhamento.ts): a
    // própria tela some e volta da lista de publicadas enquanto `trocandoTela` é true.
    falso.trocandoTela = true
    publicacoesDoEu.length = 0
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' })) // a tela some
    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')

    publicacoesDoEu.push(minhaTela)
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' })) // a tela volta
    // Sem a guarda de `trocandoTela`, a heurística de "tela própria nova" (foco.ts) roubaria o
    // destaque de volta aqui — é exatamente o que este teste prova que não acontece.
    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')

    falso.trocandoTela = false
    await usuario.click(screen.getByRole('button', { name: 'mexer no palco' })) // troca termina
    expect(palcoDe(container)).toHaveTextContent('Tela de Bia')
  })
})

describe('sala: a interface que se esconde', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function flutuante(container: HTMLElement): HTMLElement {
    return container.querySelector('[data-interface]') as HTMLElement
  }

  it('some depois de 2,6 s de mouse parado e volta ao primeiro movimento', () => {
    const { container } = montarSala()
    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')

    act(() => vi.advanceTimersByTime(2600))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'oculta')

    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')
  })

  it('com a gaveta aberta, nunca some', () => {
    const { container } = montarSala()
    fireEvent.click(screen.getByRole('button', { name: 'Conversa' }))

    act(() => vi.advanceTimersByTime(10_000))

    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')
  })

  it('clicar num botão com o mouse não a trava acesa — foco de mouse não é foco de teclado', () => {
    const { container } = montarSala()
    const botao = screen.getByRole('button', { name: 'Abrir microfone' })

    fireEvent.pointerDown(botao)
    act(() => botao.focus())
    fireEvent.click(botao)

    act(() => vi.advanceTimersByTime(2600))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'oculta')
  })

  it('o teclado dentro dela trava; e destrava quando o botão focado some do DOM', () => {
    const bia = participanteFalso('bia-x1y2', 'Bia', [publicacaoFalsa(Track.Source.ScreenShare)])
    const eu = participanteFalso('ana-a1b2c3', 'Ana', [publicacaoFalsa(Track.Source.ScreenShare)])
    falso.sala = salaFalsa(eu, [bia])
    const { container } = montarSala()

    fireEvent.keyDown(document, { key: 'Tab' })
    const miniatura = screen.getByRole('button', { name: 'Pôr a tela de Bia no palco' })
    act(() => miniatura.focus())

    act(() => vi.advanceTimersByTime(10_000))
    expect(flutuante(container)).toHaveAttribute('data-interface', 'visivel')

    // Apertar a miniatura promove a peça e tira o próprio botão do DOM. O Chrome não emite
    // `focusout` para elemento focado que sai, e sem reconferir a interface ficaria acesa.
    fireEvent.click(miniatura)

    act(() => vi.advanceTimersByTime(2600))
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

describe('sala: a validade da credencial decide só a entrada', () => {
  it('o JWT vencer durante a sala não derruba ninguém — o servidor renova o token da conexão viva', () => {
    const daquiAUmMinuto = Date.now() + 60_000
    guardarSessao(credenciaisFalsas(daquiAUmMinuto), daquiAUmMinuto)
    montar(
      <Routes>
        <Route path="/sala/:slug" element={<Cenario />} />
      </Routes>,
      '/sala/share',
    )
    expect(screen.getByRole('main', { name: 'Palco da sala' })).toBeInTheDocument()

    // Duas horas depois, um evento qualquer do palco re-renderiza a Sala — era aqui que a
    // credencial "vencida" virava null, a sala desconectava e a pessoa caía no formulário.
    vi.spyOn(Date, 'now').mockReturnValue(daquiAUmMinuto + 2 * 60 * 60 * 1000)
    fireEvent.click(screen.getByRole('button', { name: 'mexer no palco' }))

    expect(screen.getByRole('main', { name: 'Palco da sala' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Entrar na sala' })).not.toBeInTheDocument()
  })

  it('a sala caída avisa que está voltando sozinha, e em que tentativa vai', () => {
    falso.queda = { tentativa: 3 }
    montarSala()
    expect(screen.getByText(/conexão perdida/i)).toHaveTextContent('tentativa 3')
  })
})
