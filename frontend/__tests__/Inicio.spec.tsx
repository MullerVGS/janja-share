import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalaNaLista } from '../src/api/salas'
import { gravarPreferencias, lerPreferencias } from '../src/preferencias'
import { useSessao } from '../src/sessao/sessao'
import { Inicio } from '../src/telas/Inicio/Inicio'
import { montar } from './apoio/montar'
import { chamadas, servir } from './apoio/servidorFalso'

/** Fica no lugar da sala: prova que a navegação aconteceu e que a sessão guardou o slug certo. */
function SalaFalsa() {
  const { slug = '' } = useParams()
  const { credenciaisDe } = useSessao()
  const credenciais = credenciaisDe(slug)
  return (
    <div>
      entrou em {slug} como {credenciais?.nome ?? 'ninguém'} ({credenciais?.identidade ?? '?'})
    </div>
  )
}

function montarInicio() {
  return montar(
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/sala/:slug" element={<SalaFalsa />} />
    </Routes>,
    '/',
  )
}

const SALAS: SalaNaLista[] = [
  {
    slug: 'jogatina',
    nome: 'Jogatina',
    pessoas: ['Bia', 'Caio'],
    presentes: [
      { nome: 'Bia', aoVivo: true, microfoneAberto: true },
      { nome: 'Caio', aoVivo: false, microfoneAberto: false },
    ],
    telasNoAr: 1,
    cheia: false,
  },
  { slug: 'reuniao', nome: 'Reunião', pessoas: [], presentes: [], telasNoAr: 0, cheia: false },
  {
    slug: 'lotada',
    nome: 'Lotada',
    pessoas: Array.from({ length: 12 }, (_, i) => `P${i}`),
    telasNoAr: 0,
    cheia: true,
  },
]

const ROTA_DE_SUGESTAO = {
  'GET /api/salas/nome-sugerido': { corpo: { nome: 'Varanda Tranquila' } },
}

/** A linha de uma Sala na coluna: o canal de voz e quem está dentro. */
function linhaDe(nome: string): HTMLElement {
  const lista = screen.getByRole('list', { name: 'Salas no ar' })
  const item = within(lista).getByText(nome).closest('li')
  if (!item) throw new Error(`linha "${nome}" não é um <li>`)
  return item as HTMLElement
}

function prepararNome(nome = 'Ana') {
  gravarPreferencias({ nome })
}

// `preferencias` mora em `localStorage`, e o `preparo.ts` global só limpa o `sessionStorage` — sem
// isto, o nome digitado num teste vazaria para o próximo (que espera partir de nome vazio).
afterEach(() => localStorage.clear())

describe('início: a coluna das salas no ar', () => {
  it('mostra cada Sala como canal de voz, com quem está dentro', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    expect(await screen.findByText('Jogatina')).toBeInTheDocument()
    expect(screen.getByText('Reunião')).toBeInTheDocument()
    const jogatina = within(linhaDe('Jogatina')).getByRole('list', { name: 'Quem está em Jogatina' })
    expect(within(jogatina).getByText('Bia')).toBeInTheDocument()
    expect(within(jogatina).getByText('Caio')).toBeInTheDocument()
  })

  it('o selo "Ao vivo" vai em quem compartilha, e o microfone fechado em quem está mudo', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Jogatina')
    const bia = screen.getByText('Bia').closest('li') as HTMLElement
    const caio = screen.getByText('Caio').closest('li') as HTMLElement
    expect(within(bia).getByText('Ao vivo')).toBeInTheDocument()
    expect(within(bia).queryByRole('img', { name: 'microfone fechado' })).not.toBeInTheDocument()
    expect(within(caio).queryByText('Ao vivo')).not.toBeInTheDocument()
    expect(within(caio).getByRole('img', { name: 'microfone fechado' })).toBeInTheDocument()
  })

  it('um servidor que só manda os nomes ainda desenha as pessoas, sem selo e mudas', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Lotada')
    expect(within(linhaDe('Lotada')).getAllByRole('img', { name: 'microfone fechado' })).toHaveLength(12)
  })

  it('sala cheia fica desabilitada com "cheia"', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Jogatina')
    const botao = within(linhaDe('Lotada')).getByRole('button', { name: /Lotada/ })
    expect(botao).toBeDisabled()
    expect(botao).toHaveTextContent('cheia')
  })

  it('clicar na Sala vai para o link dela', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: /Jogatina/ }))

    expect(await screen.findByText(/entrou em jogatina/)).toBeInTheDocument()
  })

  it('sem sala nenhuma, a coluna diz isso e a página oferece criar', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    montarInicio()

    expect(await screen.findByText(/Nenhuma sala no ar agora/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeInTheDocument()
  })

  it('erro do GET vira aviso — nunca "nenhuma sala"', async () => {
    servir({ 'GET /api/salas': { status: 503, corpo: { erro: 'sfu_indisponivel' } } })
    montarInicio()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O servidor de mídia não respondeu. Tente de novo em instantes.',
    )
    expect(screen.queryByText(/nenhuma sala/i)).not.toBeInTheDocument()
  })

  it('erro sem lista nenhuma diz que está tentando de novo — a tela fria não lê como morta', async () => {
    servir({ 'GET /api/salas': { status: 503, corpo: { erro: 'sfu_indisponivel' } } })
    montarInicio()

    expect(await screen.findByRole('alert')).toHaveTextContent('Tentando de novo')
  })

  it('nomes repetidos na mesma sala não colidem de chave — sem aviso do React no console', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    servir({
      'GET /api/salas': {
        corpo: [{ slug: 'duplicada', nome: 'Duplicada', pessoas: ['Bia', 'Bia'], telasNoAr: 0, cheia: false }],
      },
    })
    montarInicio()

    await screen.findByText('Duplicada')
    expect(within(linhaDe('Duplicada')).getAllByText('Bia')).toHaveLength(2)
    const avisosDeChave = consoleErro.mock.calls.filter((chamada) => String(chamada[0]).includes('key'))
    expect(avisosDeChave).toEqual([])
    consoleErro.mockRestore()
  })
})

describe('início: poll de fundo (5s) que falha não apaga a lista', () => {
  // Faz nos dois lados do mount: o `useQuery` registra o `setInterval` do refetch já na
  // montagem — fake timers ligados só depois não pegam esse intervalo.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }))
  afterEach(() => vi.useRealTimers())

  it('religa em 5s (refetchInterval); um 503 no poll vira aviso por cima da lista, sem desmontá-la', async () => {
    let chamadasGet = 0
    servir({
      'GET /api/salas': () => {
        chamadasGet++
        return chamadasGet === 1 ? { corpo: SALAS } : { status: 503, corpo: { erro: 'sfu_indisponivel' } }
      },
    })
    montarInicio()

    await screen.findByText('Reunião')
    expect(chamadasGet).toBe(1)

    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(chamadasGet).toBe(2)
    vi.useRealTimers()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O servidor de mídia não respondeu. Tente de novo em instantes.',
    )
    expect(screen.getByText('Reunião')).toBeInTheDocument()
  })
})

describe('início: a página do saguão', () => {
  it('tem o disclaimer no rodapé, sem citar ninguém', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    montarInicio()

    expect((await screen.findAllByText('Qualquer semelhança é mera coincidência.')).length).toBeGreaterThan(0)
  })

  it('o trilho tem o saguão aceso e o + de criar', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    montarInicio()

    const trilho = await screen.findByRole('navigation', { name: 'Suas salas' })
    expect(within(trilho).getByRole('button', { name: 'Saguão' })).toHaveAttribute('aria-current', 'page')
    expect(within(trilho).getByRole('button', { name: 'Criar uma sala' })).toBeInTheDocument()
  })
})

describe('início: seu nome', () => {
  it('edita nas preferências do painel da pessoa e persiste', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(screen.getByRole('button', { name: 'Preferências' }))
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    expect(lerPreferencias().nome).toBe('Ana')
    expect(screen.getByRole('button', { name: 'Seu perfil e preferências' })).toHaveTextContent('Ana')
  })

  it('os sons da sala ligam e desligam nas preferências', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(screen.getByRole('button', { name: 'Preferências' }))
    await usuario.click(screen.getByRole('checkbox', { name: 'Sons da sala' }))
    expect(lerPreferencias().sons).toBe(false)
  })

  it('fora de uma sala, microfone e ensurdecer ficam apagados', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    montarInicio()

    expect(screen.getByRole('button', { name: 'Microfone' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ensurdecer' })).toBeDisabled()
  })
})

function credenciais(slug: string, nome: string) {
  return {
    token: 'jwt-do-livekit',
    urlSfu: 'wss://sfu.example.com',
    slug,
    nomeDaSala: slug,
    identidade: `${nome.toLowerCase()}-a1b2c3`,
    nome,
  }
}

describe('início: criar sala', () => {
  it('permite editar o nome sugerido e marcar sala privada nas opções avançadas', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: [] },
      ...ROTA_DE_SUGESTAO,
      'POST /api/salas': { status: 201, corpo: credenciais('nova-sala', 'Ana') },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    const nome = await within(dialogo).findByDisplayValue('Varanda Tranquila')
    await usuario.clear(nome)
    await usuario.type(nome, 'Nova Sala')
    const avancadas = within(dialogo).getByText('Opções avançadas').closest('details')
    expect(avancadas).not.toHaveAttribute('open')
    await usuario.click(within(dialogo).getByText('Opções avançadas'))
    expect(avancadas).toHaveAttribute('open')
    await usuario.click(within(dialogo).getByRole('checkbox', { name: /Sala privada/ }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await screen.findByText(/entrou em nova-sala como Ana/)).toBeInTheDocument()
    const criacao = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')
    expect(criacao?.corpo).toEqual({ nome: 'Nova Sala', privada: true, seuNome: 'Ana' })
  })

  it('mostra um nome aleatório e o dado busca outro antes de criar', async () => {
    prepararNome('Ana')
    let sugestao = 0
    servir({
      'GET /api/salas': { corpo: [] },
      'GET /api/salas/nome-sugerido': () => ({
        corpo: { nome: sugestao++ === 0 ? 'Varanda Tranquila' : 'Praia Dourada' },
      }),
      'POST /api/salas': { status: 201, corpo: credenciais('praia-dourada', 'Ana') },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    expect(await within(dialogo).findByDisplayValue('Varanda Tranquila')).toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Gerar outro nome' }))
    expect(await within(dialogo).findByDisplayValue('Praia Dourada')).toBeInTheDocument()
    const pedidosDeSugestao = chamadas.filter((chamada) => chamada.caminho === '/api/salas/nome-sugerido')
    expect(pedidosDeSugestao[1]?.busca).toBe('?nomeAtual=Varanda%20Tranquila')

    const botao = within(dialogo).getByRole('button', { name: 'Criar sala' })
    expect(botao).not.toBeDisabled()
    await usuario.click(botao)

    expect(await screen.findByText(/entrou em praia-dourada como Ana/)).toBeInTheDocument()
    const criacao = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')
    expect(criacao?.corpo).toEqual({ nome: 'Praia Dourada', seuNome: 'Ana' })
  })

  it('cria sala privada pelas opções avançadas e explica que ela não aparece no saguão', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: [] },
      ...ROTA_DE_SUGESTAO,
      'POST /api/salas': { status: 201, corpo: credenciais('varanda-tranquila', 'Ana') },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    await within(dialogo).findByDisplayValue('Varanda Tranquila')
    await usuario.click(within(dialogo).getByText('Opções avançadas'))
    expect(within(dialogo).getByText(/não aparece no saguão/i)).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('checkbox', { name: /sala privada/i }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await screen.findByText(/entrou em varanda-tranquila como Ana/)).toBeInTheDocument()
    const criacao = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')
    expect(criacao?.corpo).toEqual({ nome: 'Varanda Tranquila', privada: true, seuNome: 'Ana' })
  })

  it('sala_existe aparece na frase certa e o diálogo continua aberto', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: [] },
      ...ROTA_DE_SUGESTAO,
      'POST /api/salas': { status: 409, corpo: { erro: 'sala_existe' } },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    const nome = await within(dialogo).findByDisplayValue('Varanda Tranquila')
    await usuario.clear(nome)
    await usuario.type(nome, 'Jogatina')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Já existe uma sala com esse nome — entre nela ou escolha outro.',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fecha no botão de fechar e no Esc, sem criar nada', async () => {
    servir({ 'GET /api/salas': { corpo: [] }, ...ROTA_DE_SUGESTAO })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Criar sala' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/api/salas')).toBe(false)
  })

  it('abre com o foco no primeiro campo — o efeito do Dialogo não rouba o autoFocus', async () => {
    servir({ 'GET /api/salas': { corpo: [] }, ...ROTA_DE_SUGESTAO })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))

    expect(within(screen.getByRole('dialog')).getByLabelText('Nome da sala')).toHaveFocus()
  })

  it('devolve o foco a quem abriu o diálogo, ao fechar', async () => {
    servir({ 'GET /api/salas': { corpo: [] }, ...ROTA_DE_SUGESTAO })
    const usuario = userEvent.setup()
    montarInicio()

    const gatilho = await screen.findByRole('button', { name: 'Criar sala' })
    await usuario.click(gatilho)
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(gatilho).toHaveFocus()
  })
})
