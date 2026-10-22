import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { gravarPreferencias } from '../src/preferencias'
import { lembrarSala, lerSuasSalas } from '../src/salas/suasSalas'
import { Inicio } from '../src/telas/Inicio/Inicio'
import { quandoFoi } from '../src/telas/Inicio/SuasSalas'
import { montar } from './apoio/montar'
import { chamadas, servir } from './apoio/servidorFalso'

function Destino() {
  const local = useLocation()
  return <div>foi para {`${local.pathname}${local.search}`}</div>
}

function montarInicio() {
  return montar(
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/sala/:slug" element={<Destino />} />
    </Routes>,
    '/',
  )
}

afterEach(() => localStorage.clear())

describe('saguão: suas salas', () => {
  it('sem nenhuma lembrada, a seção não aparece', async () => {
    servir({ 'GET /api/salas': { corpo: [] } })
    montarInicio()

    expect(await screen.findByText('Nenhuma sala no ar agora.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Suas salas' })).not.toBeInTheDocument()
  })

  it('lista as lembradas — adormecidas também — e diz quem está numa delas agora', async () => {
    lembrarSala({ slug: 'eclipse', nome: 'Eclipse', privada: false, assinatura: 'a.b' })
    lembrarSala({ slug: 'cofre-c0ffee', nome: 'Cofre', privada: true, assinatura: 'c.d' })
    servir({
      'GET /api/salas': { corpo: [{ slug: 'eclipse', nome: 'Eclipse', pessoas: ['Bia', 'Caio'], telasNoAr: 1, cheia: false }] },
    })
    montarInicio()

    const secao = await screen.findByRole('region', { name: 'Suas salas' })
    const itens = within(secao).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Cofre'),
      expect.stringContaining('Eclipse'),
    ])
    expect(itens[0]).toHaveTextContent('privada · última visita hoje')
    expect(await within(itens[1]!).findByText(/2 pessoas agora/)).toBeInTheDocument()
  })

  it('entrar é um clique: vai para o link com a assinatura guardada', async () => {
    lembrarSala({ slug: 'eclipse', nome: 'Eclipse', privada: false, assinatura: 'a.b' })
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    const secao = await screen.findByRole('region', { name: 'Suas salas' })
    await usuario.click(within(secao).getByRole('button', { name: 'Entrar' }))

    expect(screen.getByText('foi para /sala/eclipse?k=a.b')).toBeInTheDocument()
  })

  it('tirar da lista esquece a Sala neste navegador', async () => {
    lembrarSala({ slug: 'eclipse', nome: 'Eclipse', privada: false, assinatura: 'a.b' })
    servir({ 'GET /api/salas': { corpo: [] } })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Tirar Eclipse da lista' }))

    expect(screen.queryByRole('region', { name: 'Suas salas' })).not.toBeInTheDocument()
    expect(lerSuasSalas()).toEqual([])
  })

  it('"hoje", "ontem" e a data curta', () => {
    const agora = new Date(2026, 9, 22, 15).getTime()
    expect(quandoFoi(new Date(2026, 9, 22, 1).getTime(), agora)).toBe('hoje')
    expect(quandoFoi(new Date(2026, 9, 21, 23).getTime(), agora)).toBe('ontem')
    expect(quandoFoi(new Date(2026, 9, 18, 12).getTime(), agora)).toBe('18/10')
  })
})

describe('criar: fixa é o padrão', () => {
  function credenciais(slug: string, fixa: boolean) {
    return {
      token: 'jwt',
      urlSfu: 'wss://sfu.example.com',
      slug,
      nomeDaSala: slug,
      identidade: 'ana-a1b2c3',
      nome: 'Ana',
      privada: false,
      fixa,
      assinatura: fixa ? 'x.y' : null,
    }
  }

  it('sem mexer em nada, a sala nasce fixa, o diálogo diz o prazo e o link sai com a assinatura', async () => {
    gravarPreferencias({ nome: 'Ana' })
    servir({
      'GET /api/salas': { corpo: [] },
      'GET /api/salas/nome-sugerido': { corpo: { nome: 'Varanda Tranquila' } },
      'POST /api/salas': { status: 201, corpo: credenciais('varanda-tranquila', true) },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    await within(dialogo).findByDisplayValue('Varanda Tranquila')
    expect(dialogo).toHaveTextContent('Fica guardada por 7 dias depois que todos saírem.')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await screen.findByText('foi para /sala/varanda-tranquila?k=x.y')).toBeInTheDocument()
    expect(chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')?.corpo).toEqual({
      nome: 'Varanda Tranquila',
      seuNome: 'Ana',
    })
  })

  it('"Apagar quando todos saírem" pede a efêmera (fixa: false) e a frase muda', async () => {
    gravarPreferencias({ nome: 'Ana' })
    servir({
      'GET /api/salas': { corpo: [] },
      'GET /api/salas/nome-sugerido': { corpo: { nome: 'Varanda Tranquila' } },
      'POST /api/salas': { status: 201, corpo: credenciais('varanda-tranquila', false) },
    })
    const usuario = userEvent.setup()
    montarInicio()

    await usuario.click(await screen.findByRole('button', { name: 'Criar sala' }))
    const dialogo = screen.getByRole('dialog')
    await within(dialogo).findByDisplayValue('Varanda Tranquila')
    await usuario.click(within(dialogo).getByText('Opções avançadas'))
    await usuario.click(within(dialogo).getByRole('checkbox', { name: /Apagar quando todos saírem/ }))
    expect(dialogo).toHaveTextContent('Some quando todos saírem.')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Criar sala' }))

    expect(await screen.findByText('foi para /sala/varanda-tranquila')).toBeInTheDocument()
    expect(chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/api/salas')?.corpo).toEqual({
      nome: 'Varanda Tranquila',
      fixa: false,
      seuNome: 'Ana',
    })
  })
})
