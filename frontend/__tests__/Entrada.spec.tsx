import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CHAVE_DA_SESSAO, useSessao } from '../src/sessao/sessao'
import { Entrada } from '../src/telas/Entrada'
import { montar } from './apoio/montar'
import { credenciaisFalsas, guardarSessao, jwtFalso } from './apoio/sessaoFalsa'
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

/**
 * `POST /api/entrar` consome um uso do convite. Recarregar a página não pode custar um uso — daí
 * a sessão guardada na aba, e daí estes testes: o que decide bater na porta é a validade do
 * passe que já está na mão.
 */
describe('reaproveitamento da sessão guardada', () => {
  it('sessão válida na aba entra direto, sem chamar /api/entrar nem a pré-checagem', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { corpo: CREDENCIAIS },
    })
    const daqui_a_uma_hora = Date.now() + 60 * 60 * 1000
    guardarSessao(credenciaisFalsas(daqui_a_uma_hora, 'Ana'), daqui_a_uma_hora)

    montarEntrada()

    expect(await screen.findByText(/na sala como Ana em share/)).toBeInTheDocument()
    expect(chamadas).toEqual([])
  })

  it('sessão vencida é descartada e a entrada volta a pedir o nome', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { corpo: CREDENCIAIS },
    })
    const uma_hora_atras = Date.now() - 60 * 60 * 1000
    guardarSessao(credenciaisFalsas(uma_hora_atras), uma_hora_atras)
    const usuario = userEvent.setup()

    montarEntrada()

    expect(await screen.findByText('Pessoal')).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    await screen.findByText(/na sala como Ana/)
    expect(chamadas.some((chamada) => chamada.caminho === '/api/entrar')).toBe(true)
  })

  it('sem sessão guardada, entrar consome o convite como sempre', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { corpo: CREDENCIAIS },
    })
    const usuario = userEvent.setup()
    montarEntrada()

    await screen.findByText('Pessoal')
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    await screen.findByText(/na sala como Ana/)
    expect(chamadas.filter((chamada) => chamada.caminho === '/api/entrar')).toHaveLength(1)
  })

  it('o que entrou fica guardado na aba — é o que sobrevive ao recarregamento', async () => {
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { corpo: CREDENCIAIS },
    })
    const usuario = userEvent.setup()
    montarEntrada()

    await screen.findByText('Pessoal')
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText(/na sala como Ana/)

    const guardado = JSON.parse(sessionStorage.getItem(CHAVE_DA_SESSAO) as string)
    expect(guardado.credenciais).toEqual(CREDENCIAIS)
    expect(guardado.expiraEm).toBeGreaterThan(Date.now())
  })

  it('a validade guardada vem do exp do próprio JWT, não de um palpite do front', async () => {
    const expira = Date.now() + 2 * 60 * 60 * 1000
    servir({
      [`GET /api/convites/${TOKEN}`]: { corpo: { valido: true, rotulo: 'Pessoal' } },
      'POST /api/entrar': { corpo: { ...CREDENCIAIS, token: jwtFalso(expira) } },
    })
    const usuario = userEvent.setup()
    montarEntrada()

    await screen.findByText('Pessoal')
    await usuario.type(screen.getByLabelText('Seu nome'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText(/na sala como Ana/)

    const guardado = JSON.parse(sessionStorage.getItem(CHAVE_DA_SESSAO) as string)
    // Segundos inteiros no JWT; a comparação tolera o arredondamento, não oito horas de palpite.
    expect(Math.abs(guardado.expiraEm - expira)).toBeLessThan(1000)
  })
})
