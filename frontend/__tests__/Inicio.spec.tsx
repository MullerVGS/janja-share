import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useParams } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  { slug: 'jogatina', nome: 'Jogatina', pessoas: ['Bia', 'Caio'], telasNoAr: 2, temSenha: false, cheia: false },
  { slug: 'reuniao', nome: 'Reunião', pessoas: [], telasNoAr: 0, temSenha: true, cheia: false },
  {
    slug: 'lotada',
    nome: 'Lotada',
    pessoas: Array.from({ length: 12 }, (_, i) => `P${i}`),
    telasNoAr: 0,
    temSenha: false,
    cheia: true,
  },
]

function linhaDe(nome: string): HTMLElement {
  const item = screen.getByText(nome).closest('li')
  if (!item) throw new Error(`linha "${nome}" não é um <li>`)
  return item as HTMLElement
}

function prepararNome(nome = 'Ana') {
  gravarPreferencias({ nome })
}

// `preferencias` mora em `localStorage`, e o `preparo.ts` global só limpa o `sessionStorage` — sem
// isto, o nome digitado num teste vazaria para o próximo (que espera partir de nome vazio).
afterEach(() => localStorage.clear())

describe('início: lista de salas', () => {
  it('renderiza as salas da API', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    expect(await screen.findByText('Jogatina')).toBeInTheDocument()
    expect(screen.getByText('Reunião')).toBeInTheDocument()
    expect(screen.getByText('Lotada')).toBeInTheDocument()
  })

  it('mostra o badge de telas no ar só quando há telas', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Jogatina')
    expect(within(linhaDe('Jogatina')).getByText(/2 telas no ar/)).toBeInTheDocument()
    expect(within(linhaDe('Reunião')).queryByText(/telas no ar/)).not.toBeInTheDocument()
  })

  it('mostra o cadeado só na sala com senha', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Jogatina')
    expect(within(linhaDe('Reunião')).getByTitle('Sala com senha')).toBeInTheDocument()
    expect(within(linhaDe('Jogatina')).queryByTitle('Sala com senha')).not.toBeInTheDocument()
  })

  it('sala vazia em carência fica apagada, com "ninguém agora"', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Jogatina')
    const linha = linhaDe('Reunião')
    expect(within(linha).getByText('ninguém agora')).toBeInTheDocument()
    expect(linha).toHaveAttribute('data-vazia')
  })

  it('sala cheia desabilita o Entrar com "cheia"', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    await screen.findByText('Jogatina')
    const botao = within(linhaDe('Lotada')).getByRole('button', { name: /cheia/i })
    expect(botao).toBeDisabled()
  })

  it('sem sala nenhuma, o estado vazio põe o criar em destaque', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    montarInicio()

    expect(await screen.findByRole('button', { name: 'Criar sala' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('erro do GET vira Aviso — nunca "nenhuma sala"', async () => {
    servir({ 'GET /api/salas': { status: 503, corpo: { erro: 'sfu_indisponivel' } } })
    montarInicio()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O servidor de mídia não respondeu. Tente de novo em instantes.',
    )
    expect(screen.queryByText(/nenhuma sala/i)).not.toBeInTheDocument()
  })
})

describe('início: poll de fundo (5s) que falha não apaga a lista nem o que a pessoa digitou', () => {
  // Faz nos dois lados do mount: o `useQuery` registra o `setInterval` do refetch já na
  // montagem — fake timers ligados só depois não pegam esse intervalo (ele fica preso ao
  // `setInterval` real), e o segundo poll nunca dispara dentro do tempo falso do teste.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }))
  afterEach(() => vi.useRealTimers())

  it('religa em 5s (refetchInterval); um 503 no poll vira aviso por cima da lista, sem desmontar a linha', async () => {
    let chamadasGet = 0
    servir({
      'GET /api/salas': () => {
        chamadasGet++
        return chamadasGet === 1 ? { corpo: SALAS } : { status: 503, corpo: { erro: 'sfu_indisponivel' } }
      },
    })
    // `delay: null`: sem isso, o `userEvent` conta com `setTimeout` real entre teclas, e só o
    // `setInterval` está fake aqui — misturar os dois regimes de tempo trava o teste.
    const usuario = userEvent.setup({ delay: null })
    montarInicio()

    await screen.findByText('Reunião')
    await usuario.click(within(linhaDe('Reunião')).getByRole('button', { name: 'Entrar' }))
    await usuario.type(within(linhaDe('Reunião')).getByLabelText('Senha'), 'meio-digitada')
    expect(chamadasGet).toBe(1)

    // `Async`, e não `advanceTimersByTime`: precisa dar vez ao microtask do `fetch` mockado
    // para o segundo `GET` sair. Depois, volta para timers reais — o resto da cadeia (`.json()`,
    // o processamento interno do react-query, o re-render) é assíncrono demais para garantir em
    // quantos ticks falsos termina, e `findByRole` com timer real resolve isso sem chute.
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(chamadasGet).toBe(2)
    vi.useRealTimers()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O servidor de mídia não respondeu. Tente de novo em instantes.',
    )
    // A lista continua — a linha não desmontou, e a senha meio-digitada não sumiu.
    expect(screen.getByText('Reunião')).toBeInTheDocument()
    expect(within(linhaDe('Reunião')).getByLabelText('Senha')).toHaveValue('meio-digitada')
  })
})

describe('início: linha de sala — robustez', () => {
  it('nomes repetidos na mesma sala não colidem de chave — sem aviso do React no console', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    servir({
      'GET /api/salas': {
        corpo: [
          { slug: 'duplicada', nome: 'Duplicada', pessoas: ['Bia', 'Bia'], telasNoAr: 0, temSenha: false, cheia: false },
        ],
      },
    })
    montarInicio()

    await screen.findByText('Duplicada')
    expect(within(linhaDe('Duplicada')).getAllByTitle('Bia')).toHaveLength(2)
    const avisosDeChave = consoleErro.mock.calls.filter((chamada) => String(chamada[0]).includes('key'))
    expect(avisosDeChave).toEqual([])
    consoleErro.mockRestore()
  })

  it('mais de 6 pessoas mostra os 6 primeiros avatares e um "+N" para o resto', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    montarInicio()

    const linha = await screen.findByText('Lotada').then(() => linhaDe('Lotada'))
    expect(within(linha).getAllByTitle(/^P\d+$/)).toHaveLength(6)
    expect(within(linha).getByText('+6')).toBeInTheDocument()
  })

  it('Cancelar fecha o formulário expandido e esquece o que foi digitado', async () => {
    servir({ 'GET /api/salas': { corpo: SALAS } })
    const usuario = userEvent.setup()
    montarInicio()

    await screen.findByText('Reunião')
    const linha = linhaDe('Reunião')
    await usuario.click(within(linha).getByRole('button', { name: 'Entrar' }))
    await usuario.type(within(linha).getByLabelText('Senha'), 'alguma coisa')

    await usuario.click(within(linha).getByRole('button', { name: 'Cancelar' }))

    expect(within(linha).queryByLabelText('Senha')).not.toBeInTheDocument()
    expect(within(linha).getByRole('button', { name: 'Entrar' })).toBeInTheDocument()

    // Reabrir prova que o campo esqueceu o que tinha antes.
    await usuario.click(within(linha).getByRole('button', { name: 'Entrar' }))
    expect(within(linha).getByLabelText('Senha')).toHaveValue('')
  })

  it('erro no caminho direto (sem senha, nome já sabido) expande a linha em vez de só mostrar a frase', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: SALAS },
      'POST /api/salas/jogatina/entrar': { status: 400, corpo: { erro: 'nome_invalido' } },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await screen.findByText('Jogatina')
    const linha = linhaDe('Jogatina')
    await usuario.click(within(linha).getByRole('button', { name: 'Entrar' }))

    expect(await within(linha).findByRole('alert')).toHaveTextContent('Escolha um nome com 1 a 40 caracteres.')
    // Expandiu: agora há um jeito de agir, não só a frase — aqui, cancelar.
    expect(within(linha).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })
})

describe('início: seu nome', () => {
  it('edita e persiste em preferências', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    expect(lerPreferencias().nome).toBe('Ana')
  })

  it('vazio bloqueia o Entrar até preencher — pede o nome no próprio formulário da linha', async () => {
    servir({
      'GET /api/salas': { corpo: SALAS },
      'POST /api/salas/jogatina/entrar': { corpo: credenciais('jogatina', 'Duda') },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await screen.findByText('Jogatina')
    await usuario.click(within(linhaDe('Jogatina')).getByRole('button', { name: 'Entrar' }))

    expect(chamadas.some((c) => c.caminho === '/api/salas/jogatina/entrar')).toBe(false)
    const campoNome = within(linhaDe('Jogatina')).getByLabelText('Seu nome')
    await usuario.type(campoNome, 'Duda')
    await usuario.click(within(linhaDe('Jogatina')).getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/entrou em jogatina como Duda/)).toBeInTheDocument()
    expect(lerPreferencias().nome).toBe('Duda')
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

describe('início: entrar', () => {
  it('sem senha, o Entrar vai direto — sem tela intermediária', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: SALAS },
      'POST /api/salas/jogatina/entrar': { corpo: credenciais('jogatina', 'Ana') },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await screen.findByText('Jogatina')
    await usuario.click(within(linhaDe('Jogatina')).getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/entrou em jogatina como Ana/)).toBeInTheDocument()
    const entrada = chamadas.find((c) => c.caminho === '/api/salas/jogatina/entrar')
    expect(entrada?.corpo).toEqual({ seuNome: 'Ana' })
  })

  it('com senha, o campo expande na própria linha', async () => {
    prepararNome('Ana')
    servir({ 'GET /api/salas': { corpo: SALAS } })
    const usuario = userEvent.setup()
    montarInicio()

    await screen.findByText('Jogatina')
    await usuario.click(within(linhaDe('Reunião')).getByRole('button', { name: 'Entrar' }))

    expect(within(linhaDe('Reunião')).getByLabelText('Senha')).toBeInTheDocument()
    expect(chamadas.some((c) => c.caminho.includes('/entrar'))).toBe(false)
  })

  it('senha incorreta aparece e o campo continua lá', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: SALAS },
      'POST /api/salas/reuniao/entrar': { status: 401, corpo: { erro: 'senha_incorreta' } },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await screen.findByText('Jogatina')
    const linha = linhaDe('Reunião')
    await usuario.click(within(linha).getByRole('button', { name: 'Entrar' }))
    await usuario.type(within(linha).getByLabelText('Senha'), 'errada')
    await usuario.click(within(linha).getByRole('button', { name: 'Entrar' }))

    expect(await within(linha).findByRole('alert')).toHaveTextContent('Senha incorreta.')
    expect(within(linha).getByLabelText('Senha')).toBeInTheDocument()
  })
})

describe('início: criar sala', () => {
  it('chama a API com nome e senha, guarda a sessão e navega para a sala', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: [] },
      'POST /api/salas': { status: 201, corpo: credenciais('nova-sala', 'Ana') },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText('Nome da sala'), 'Nova Sala')
    await usuario.type(within(dialogo).getByLabelText('Senha (opcional)'), 'segredo123')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await screen.findByText(/entrou em nova-sala como Ana/)).toBeInTheDocument()
    const criacao = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')
    expect(criacao?.corpo).toEqual({ nome: 'Nova Sala', senha: 'segredo123', seuNome: 'Ana' })
  })

  it('sala_existe aparece na frase certa e o diálogo continua aberto', async () => {
    prepararNome('Ana')
    servir({
      'GET /api/salas': { corpo: [] },
      'POST /api/salas': { status: 409, corpo: { erro: 'sala_existe' } },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText('Nome da sala'), 'Jogatina')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Já existe uma sala com esse nome — entre nela ou escolha outro.',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fecha no botão de fechar e no Esc, sem criar nada', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
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
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))

    expect(within(screen.getByRole('dialog')).getByLabelText('Nome da sala')).toHaveFocus()
  })

  it('devolve o foco a quem abriu o diálogo, ao fechar', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    const gatilho = await screen.findByRole('button', { name: 'Criar sala' })
    await usuario.click(gatilho)
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(gatilho).toHaveFocus()
  })
})
