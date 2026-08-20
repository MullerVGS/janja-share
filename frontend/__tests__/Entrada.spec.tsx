import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useSessao } from '../src/sessao/sessao'
import { Entrada } from '../src/telas/Entrada'
import { montar } from './apoio/montar'
import { chamadas, servidorMudo, servir } from './apoio/servidorFalso'

const TOKEN = 'tOk3n-de-convite'

/** Fica no lugar da sala: prova que a navegação aconteceu e que a sessão chegou inteira. */
function SalaFalsa() {
  const { credenciais } = useSessao()
  return <div>na sala como {credenciais?.nome ?? 'ninguém'} em {credenciais?.sala ?? 'lugar nenhum'}</div>
}

function montarEntrada() {
  return montar(
    <Routes>
      <Route path="/c/:token" element={<Entrada />} />
      <Route path="/sala" element={<SalaFalsa />} />
    </Routes>,
    `/c/${TOKEN}`,
  )
}

const CREDENCIAIS = {
  token: 'jwt-do-livekit',
  urlSfu: 'wss://sfu.example.com',
  sala: 'share',
  identidade: 'ana-a1b2c3',
  nome: 'Ana',
}

describe('tela de entrada', () => {
  it('pré-checa o convite, mostra o rótulo e leva para a sala com a sessão guardada', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { corpo: CREDENCIAIS },
    })
    const usuario = userEvent.setup()
    montarEntrada()

    expect(await screen.findByText('Pessoal')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Seu nome'), '  Ana  ')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/na sala como Ana em share/)).toBeInTheDocument()

    const entrada = chamadas.find((chamada) => chamada.caminho === '/api/entrar')
    expect(entrada?.corpo).toEqual({ convite: TOKEN, nome: 'Ana' })
  })

  it('a pré-checagem não consome uso: só uma chamada, e de leitura', async () => {
    servir({ [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } } })
    montarEntrada()

    await screen.findByText('Pessoal')
    expect(chamadas).toEqual([{ metodo: 'GET', caminho: `/api/convites/${TOKEN}`, corpo: undefined }])
  })

  it.each([
    [404, 'convite_invalido', 'Este convite não existe. Confira se o link foi copiado inteiro.'],
    [410, 'convite_expirado', 'Este convite expirou. Peça um link novo a quem te chamou.'],
    [410, 'convite_esgotado', 'Este convite já foi usado o número de vezes permitido.'],
    [410, 'convite_revogado', 'Este convite foi revogado.'],
  ])('recusa %i %s explicando o motivo e sem pedir o nome', async (status, codigo, frase) => {
    servir({ [`GET /api/convites/${TOKEN}`]: { status, corpo: { erro: codigo } } })
    montarEntrada()

    expect(await screen.findByRole('alert')).toHaveTextContent(frase)
    expect(screen.queryByLabelText('Seu nome')).not.toBeInTheDocument()
  })

  it('mostra o erro do POST /api/entrar sem sair da tela', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { status: 400, corpo: { erro: 'nome_invalido' } },
    })
    const usuario = userEvent.setup()
    montarEntrada()

    await screen.findByText('Pessoal')
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha um nome com 1 a 40 caracteres.')
    expect(screen.queryByText(/na sala como/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Ana')
  })

  it('um convite que virou inválido entre a pré-checagem e o envio explica o que houve', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { status: 410, corpo: { erro: 'convite_esgotado' } },
    })
    const usuario = userEvent.setup()
    montarEntrada()

    await screen.findByText('Pessoal')
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este convite já foi usado o número de vezes permitido.')
  })

  it('servidor fora do ar vira mensagem de conexão, não tela em branco', async () => {
    servidorMudo()
    montarEntrada()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com o servidor. Confira sua conexão.',
    )
  })

  it('não deixa enviar com o nome vazio', async () => {
    servir({ [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } } })
    const usuario = userEvent.setup()
    montarEntrada()

    await screen.findByText('Pessoal')
    const botao = screen.getByRole('button', { name: 'Entrar' })
    expect(botao).toBeDisabled()

    await usuario.type(screen.getByLabelText('Seu nome'), '   ')
    expect(botao).toBeDisabled()

    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await waitFor(() => expect(botao).toBeEnabled())
  })
})
