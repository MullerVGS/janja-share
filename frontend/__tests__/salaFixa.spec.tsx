import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoomEvent, type Room } from 'livekit-client'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Credenciais } from '../src/api/salas'
import { gravarPreferencias } from '../src/preferencias'
import { lembrarSala, lerSuasSalas } from '../src/salas/suasSalas'
import { CHAVE_DA_SESSAO } from '../src/sessao/sessao'
import { Sala } from '../src/telas/Sala/Sala'
import { assinaturaFalsa } from './apoio/assinaturaFalsa'
import { montar } from './apoio/montar'
import { emitirNaSala, participanteFalso, salaFalsa } from './apoio/salaFalsa'
import { credenciaisFalsas, guardarSessao } from './apoio/sessaoFalsa'
import { chamadas, servir } from './apoio/servidorFalso'

const falso = vi.hoisted(() => ({
  sala: null as Room | null,
  /** Cada credencial com que o `useSala` foi chamado: outra identidade = outra conexão. */
  credenciaisVistas: [] as unknown[],
}))

vi.mock('../src/sala/useSala', async () => {
  const { ConnectionState } = await import('livekit-client')
  return {
    useSala: (credenciais: unknown) => {
      if (credenciais) falso.credenciaisVistas.push(credenciais)
      return {
        sala: credenciais ? falso.sala : null,
        conexao: ConnectionState.Connected,
        erro: null,
        queda: null,
        versao: 0,
        audioLiberado: true,
        liberarAudio() {},
      }
    },
  }
})

vi.mock('../src/telemetria/useTelemetria', async () => {
  const { TELEMETRIA_VAZIA } = await import('../src/telemetria/coletor')
  return { useTelemetria: () => ({ ...TELEMETRIA_VAZIA, rearmarRecepcao: vi.fn() }) }
})

vi.mock('../src/sala/useCompartilhamento', async () => {
  const { compartilhamentoFalso } = await import('./apoio/compartilhamentoFalso')
  return { useCompartilhamento: () => compartilhamentoFalso({ ativo: false }) }
})

/** A barra de endereço do teste. */
function Endereco() {
  const local = useLocation()
  return <output data-testid="endereco">{`${local.pathname}${local.search}`}</output>
}

function montarNa(rota: string) {
  return montar(
    <>
      <Routes>
        <Route path="/sala/:slug" element={<Sala />} />
        <Route path="/" element={<div>início</div>} />
      </Routes>
      <Endereco />
    </>,
    rota,
  )
}

const endereco = () => screen.getByTestId('endereco').textContent

function credenciaisFixas(parcial: Partial<Credenciais> = {}): Credenciais {
  return {
    ...credenciaisFalsas(Date.now() + 60 * 60 * 1000, 'Ana', 'eclipse'),
    nomeDaSala: 'Eclipse',
    privada: false,
    fixa: true,
    assinatura: 'nova.k',
    ...parcial,
  }
}

function sessaoGuardada(): Record<string, unknown> {
  return JSON.parse(sessionStorage.getItem(CHAVE_DA_SESSAO) ?? '{}') as Record<string, unknown>
}

afterEach(() => {
  falso.sala = null
  falso.credenciaisVistas = []
  localStorage.clear()
})

describe('sala fixa: o link é a identidade', () => {
  it('com o nome guardado, o link entra direto, manda a assinatura e a URL fica com a assinatura nova', async () => {
    gravarPreferencias({ nome: 'Ana' })
    const k = assinaturaFalsa('Eclipse', false)
    servir({ 'POST /api/salas/eclipse/entrar': { corpo: credenciaisFixas() } })

    montarNa(`/sala/eclipse?k=${k}`)

    expect(await screen.findByRole('region', { name: 'Sala Eclipse' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Seu nome')).not.toBeInTheDocument()
    expect(chamadas.find((c) => c.caminho === '/api/salas/eclipse/entrar')?.corpo).toEqual({ seuNome: 'Ana', assinatura: k })
    await waitFor(() => expect(endereco()).toBe('/sala/eclipse?k=nova.k'))
    expect(lerSuasSalas()).toEqual([expect.objectContaining({ slug: 'eclipse', nome: 'Eclipse', assinatura: 'nova.k' })])
  })

  it('enquanto entra direto, a espera diz onde e como — e dá para voltar', async () => {
    gravarPreferencias({ nome: 'Ana' })
    servir({ 'POST /api/salas/eclipse/entrar': () => new Promise(() => {}) })
    const usuario = userEvent.setup()

    montarNa(`/sala/eclipse?k=${assinaturaFalsa('Eclipse', false)}`)

    const dialogo = screen.getByRole('dialog', { name: 'Entrando na sala' })
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Entrando em Eclipse como Ana…')
    await usuario.click(screen.getByRole('button', { name: 'Voltar ao saguão' }))
    expect(screen.getByText('início')).toBeInTheDocument()
  })

  it('sem nome guardado, pergunta o nome e manda a assinatura junto', async () => {
    const k = assinaturaFalsa('Eclipse', false)
    servir({ 'POST /api/salas/eclipse/entrar': { corpo: credenciaisFixas() } })
    const usuario = userEvent.setup()
    montarNa(`/sala/eclipse?k=${k}`)

    const dialogo = screen.getByRole('dialog', { name: 'Entrar na sala' })
    await usuario.type(within(dialogo).getByLabelText('Seu nome'), 'Ana')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('region', { name: 'Sala Eclipse' })).toBeInTheDocument()
    expect(chamadas.find((c) => c.caminho === '/api/salas/eclipse/entrar')?.corpo).toEqual({ seuNome: 'Ana', assinatura: k })
  })

  it('a Sala fixa diz o prazo na sala; a efêmera diz que some', async () => {
    const daquiAUmaHora = Date.now() + 60 * 60 * 1000
    guardarSessao(credenciaisFixas(), daquiAUmaHora)
    const { unmount } = montarNa('/sala/eclipse?k=nova.k')
    expect(screen.getByText('fixa')).toHaveAttribute('title', 'Fica guardada por 7 dias depois que todos saírem.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Convidar' })[0]!)
    const convite = screen.getByRole('dialog', { name: 'Convide a turma para Eclipse' })
    expect(convite).toHaveTextContent('Fica guardada por 7 dias depois que todos saírem.')
    expect(within(convite).getByLabelText('Link da sala')).toHaveValue(`${window.location.origin}/sala/eclipse?k=nova.k`)
    unmount()

    guardarSessao(credenciaisFixas({ slug: 'rapida', nomeDaSala: 'Rápida', fixa: false, assinatura: null }), daquiAUmaHora)
    montarNa('/sala/rapida')
    expect(screen.getByText('efêmera')).toHaveAttribute('title', 'Some quando todos saírem.')
    expect(endereco()).toBe('/sala/rapida')
    expect(lerSuasSalas().map((sala) => sala.slug)).toEqual(['eclipse'])
  })
})

describe('sala fixa: expirada com saída', () => {
  it('sala_expirada: "Esta sala expirou" com o nome do link, e criar de novo usa mesmo nome e visibilidade', async () => {
    gravarPreferencias({ nome: 'Ana' })
    const nova = credenciaisFixas({ slug: 'escondida-ffffff', nomeDaSala: 'Escondida', privada: true, assinatura: 'novo.link' })
    servir({
      'POST /api/salas/escondida-abc123/entrar': { status: 404, corpo: { erro: 'sala_expirada' } },
      'POST /api/salas': { status: 201, corpo: nova },
    })
    const usuario = userEvent.setup()
    montarNa(`/sala/escondida-abc123?k=${assinaturaFalsa('Escondida', true, Date.now() - 1000)}`)

    const dialogo = await screen.findByRole('dialog', { name: 'Esta sala expirou' })
    expect(dialogo).toHaveTextContent('Ninguém voltou a Escondida em 7 dias')
    expect(dialogo).toHaveTextContent('A nova se chama Escondida, é privada e ganha um link novo.')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar de novo com o mesmo nome' }))

    expect(await screen.findByRole('region', { name: 'Sala Escondida' })).toBeInTheDocument()
    expect(chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')?.corpo).toEqual({
      nome: 'Escondida',
      privada: true,
      seuNome: 'Ana',
    })
    await waitFor(() => expect(endereco()).toBe('/sala/escondida-ffffff?k=novo.link'))
  })

  it('sala_nao_existe sem assinatura: também expirou, com o nome que "Suas salas" lembra', async () => {
    gravarPreferencias({ nome: 'Ana' })
    lembrarSala({ slug: 'eclipse-3', nome: 'Eclipse #3', privada: false, assinatura: null })
    servir({ 'POST /api/salas/eclipse-3/entrar': { status: 404, corpo: { erro: 'sala_nao_existe' } } })

    montarNa('/sala/eclipse-3')

    const dialogo = await screen.findByRole('dialog', { name: 'Esta sala expirou' })
    expect(dialogo).toHaveTextContent('#eclipse-3 não está mais no ar e não ficou guardada.')
    expect(dialogo).toHaveTextContent('A nova se chama Eclipse #3.')
  })

  it('a turma recriou primeiro (sala_existe): entra na que já existe', async () => {
    gravarPreferencias({ nome: 'Ana' })
    let tentativas = 0
    servir({
      'POST /api/salas/eclipse/entrar': () =>
        tentativas++ === 0 ? { status: 404, corpo: { erro: 'sala_expirada' } } : { corpo: credenciaisFixas() },
      'POST /api/salas': { status: 409, corpo: { erro: 'sala_existe' } },
    })
    const usuario = userEvent.setup()
    montarNa(`/sala/eclipse?k=${assinaturaFalsa('Eclipse', false, Date.now() - 1000)}`)

    await usuario.click(await screen.findByRole('button', { name: 'Criar de novo com o mesmo nome' }))

    expect(await screen.findByRole('region', { name: 'Sala Eclipse' })).toBeInTheDocument()
    expect(tentativas).toBe(2)
  })

  it('assinatura_invalida: explica que o link chegou alterado e não oferece recriar', async () => {
    gravarPreferencias({ nome: 'Ana' })
    servir({ 'POST /api/salas/eclipse/entrar': { status: 404, corpo: { erro: 'assinatura_invalida' } } })
    const usuario = userEvent.setup()
    montarNa('/sala/eclipse?k=adulterada.x')

    const dialogo = await screen.findByRole('dialog', { name: 'Este link não abre a sala' })
    expect(dialogo).toHaveTextContent('alterado ou incompleto')
    expect(within(dialogo).queryByRole('button', { name: /Criar de novo/ })).not.toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Voltar ao saguão' }))
    expect(screen.getByText('início')).toBeInTheDocument()
  })
})

describe('sala fixa: nome e visibilidade depois de criar', () => {
  function salaComAna() {
    const eu = participanteFalso('ana-a1b2c3', 'Ana')
    falso.sala = salaFalsa(eu)
    guardarSessao(credenciaisFixas({ assinatura: 'a.a' }), Date.now() + 60 * 60 * 1000)
    lembrarSala({ slug: 'eclipse', nome: 'Eclipse', privada: false, assinatura: 'a.a' })
    return montarNa('/sala/eclipse?k=a.a')
  }

  it('alguém muda o nome: URL, convite, sessão e "Suas salas" seguem o link novo, e a conexão não reinicia', async () => {
    salaComAna()
    expect(endereco()).toBe('/sala/eclipse?k=a.a')

    act(() =>
      emitirNaSala(
        falso.sala!,
        RoomEvent.RoomMetadataChanged,
        JSON.stringify({ slug: 'lua', nome: 'Lua', privada: false, fixa: true, assinatura: 'b.b', anteriores: ['eclipse'] }),
      ),
    )

    await waitFor(() => expect(endereco()).toBe('/sala/lua?k=b.b'))
    expect(screen.getByRole('region', { name: 'Sala Lua' })).toBeInTheDocument()
    expect(screen.getByText(/A sala agora se chama Lua\. O link mudou junto/)).toBeInTheDocument()
    expect(Object.keys(sessaoGuardada())).toEqual(['lua'])
    expect(lerSuasSalas().map((sala) => [sala.slug, sala.assinatura])).toEqual([['lua', 'b.b']])
    expect(new Set(falso.credenciaisVistas).size).toBe(1)
  })

  it('o lápis do topo ajusta pelo PATCH, com o token da sala, e a barra leva o link novo', async () => {
    salaComAna()
    servir({
      'PATCH /api/salas/eclipse': {
        corpo: { slug: 'lua-c0ffee', nomeDaSala: 'Lua', privada: true, fixa: true, assinatura: 'c.c' },
      },
    })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Mudar nome ou visibilidade' }))
    const dialogo = screen.getByRole('dialog', { name: 'Ajustar sala' })
    const nome = within(dialogo).getByLabelText('Nome da sala')
    await usuario.clear(nome)
    await usuario.type(nome, 'Lua')
    await usuario.click(within(dialogo).getByRole('checkbox', { name: /Sala privada/ }))
    expect(dialogo).toHaveTextContent('O link pode mudar')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(endereco()).toBe('/sala/lua-c0ffee?k=c.c'))
    expect(screen.queryByRole('dialog', { name: 'Ajustar sala' })).not.toBeInTheDocument()
    const patch = chamadas.find((c) => c.metodo === 'PATCH')
    expect(patch?.corpo).toEqual({ nome: 'Lua', privada: true })
    const [, init] = (fetch as unknown as Mock).mock.calls.find(([, opcoes]) => opcoes?.method === 'PATCH')!
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${credenciaisFixas().token}`)
    expect(new Set(falso.credenciaisVistas).size).toBe(1)
  })

  it('o PATCH recusado mostra o motivo e não mexe no link', async () => {
    salaComAna()
    servir({ 'PATCH /api/salas/eclipse': { status: 409, corpo: { erro: 'sala_existe' } } })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Mudar nome ou visibilidade' }))
    const dialogo = screen.getByRole('dialog', { name: 'Ajustar sala' })
    await usuario.type(within(dialogo).getByLabelText('Nome da sala'), ' 2')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialogo).findByText(/Já existe uma sala com esse nome/)).toBeInTheDocument()
    expect(endereco()).toBe('/sala/eclipse?k=a.a')
  })
})
