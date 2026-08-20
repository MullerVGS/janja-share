import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Admin } from '../src/telas/Admin/Admin'
import { montar } from './apoio/montar'
import { chamadas, servir } from './apoio/servidorFalso'

const CONFIG = { urlSfu: 'wss://sfu.example.com', sala: 'share' }

const CONVITE_NA_LISTA = {
  id: 'c1',
  rotulo: 'Pessoal',
  criadoEm: '2026-08-19T12:00:00Z',
  expiraEm: '2030-08-21T12:00:00Z',
  usosMax: 5,
  usos: 1,
  revogadoEm: null,
  ativo: true,
}

describe('painel de convites', () => {
  it('cria o convite e mostra o link uma única vez, avisando que não volta', async () => {
    servir({
      'GET /api/config': { corpo: CONFIG },
      'GET /api/admin/convites': { corpo: [] },
      'GET /api/admin/sala': { corpo: { participantes: [] } },
      'POST /api/admin/convites': {
        status: 201,
        corpo: { id: 'c9', rotulo: 'Pessoal', link: 'https://share.example.com/c/abc123' },
      },
    })
    const usuario = userEvent.setup()
    montar(<Admin />, '/admin')

    await usuario.type(await screen.findByLabelText('Rótulo'), 'Pessoal')
    await usuario.clear(screen.getByLabelText('Validade (horas)'))
    await usuario.type(screen.getByLabelText('Validade (horas)'), '48')
    await usuario.click(screen.getByRole('button', { name: 'Criar convite' }))

    const link = await screen.findByDisplayValue('https://share.example.com/c/abc123')
    expect(link).toHaveAttribute('readonly')
    expect(screen.getByText(/não pode ser mostrado de novo/)).toBeInTheDocument()

    expect(chamadas.find((chamada) => chamada.metodo === 'POST')?.corpo).toEqual({
      rotulo: 'Pessoal',
      validadeHoras: 48,
      usosMax: 5,
    })

    // `userEvent.setup()` instala uma área de transferência de mentira; ler dela prova que o
    // botão copiou o link, e não outra coisa.
    await usuario.click(screen.getByRole('button', { name: /copiar/ }))
    expect(await navigator.clipboard.readText()).toBe('https://share.example.com/c/abc123')
    expect(await screen.findByRole('button', { name: /copiado/ })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'já copiei, pode sumir' }))
    expect(screen.queryByDisplayValue('https://share.example.com/c/abc123')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Rótulo')).toBeInTheDocument()
  })

  it('marcar usos ilimitados manda usosMax nulo', async () => {
    servir({
      'GET /api/config': { corpo: CONFIG },
      'GET /api/admin/convites': { corpo: [] },
      'GET /api/admin/sala': { corpo: { participantes: [] } },
      'POST /api/admin/convites': { status: 201, corpo: { id: 'c9', rotulo: 'Aberto', link: 'https://x/c/y' } },
    })
    const usuario = userEvent.setup()
    montar(<Admin />, '/admin')

    await usuario.type(await screen.findByLabelText('Rótulo'), 'Aberto')
    await usuario.click(screen.getByLabelText('usos ilimitados'))
    await usuario.click(screen.getByRole('button', { name: 'Criar convite' }))

    await waitFor(() => expect(chamadas.some((chamada) => chamada.metodo === 'POST')).toBe(true))
    expect(chamadas.find((chamada) => chamada.metodo === 'POST')?.corpo).toMatchObject({ usosMax: null })
  })

  it('lista os convites e revoga pelo id', async () => {
    servir({
      'GET /api/config': { corpo: CONFIG },
      'GET /api/admin/convites': { corpo: [CONVITE_NA_LISTA] },
      'GET /api/admin/sala': { corpo: { participantes: [] } },
      'DELETE /api/admin/convites/c1': { status: 204 },
    })
    const usuario = userEvent.setup()
    montar(<Admin />, '/admin')

    const linha = (await screen.findByText('Pessoal')).closest('tr')
    expect(within(linha as HTMLElement).getByText('ativo')).toBeInTheDocument()
    expect(within(linha as HTMLElement).getByText('1 / 5')).toBeInTheDocument()

    await usuario.click(within(linha as HTMLElement).getByRole('button', { name: 'Revogar' }))

    await waitFor(() =>
      expect(chamadas.some((chamada) => chamada.metodo === 'DELETE' && chamada.caminho === '/api/admin/convites/c1')).toBe(
        true,
      ),
    )
  })

  it('404 na rota inteira é a guarda de host, e a tela diz isso', async () => {
    servir({
      'GET /api/config': { corpo: CONFIG },
      // A guarda responde 404 sem o corpo do contrato — é o Nest recusando a rota.
      'GET /api/admin/convites': { status: 404, corpo: { statusCode: 404, message: 'Cannot GET /api/admin/convites' } },
      'GET /api/admin/sala': { status: 404, corpo: { statusCode: 404 } },
    })
    montar(<Admin />, '/admin')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este painel só responde no host de administração.',
    )
  })

  it('mostra quem está na sala agora, com quem compartilha tela', async () => {
    servir({
      'GET /api/config': { corpo: CONFIG },
      'GET /api/admin/convites': { corpo: [] },
      'GET /api/admin/sala': {
        corpo: {
          participantes: [
            { identidade: 'ana-a1b2c3', nome: 'Ana', entrouEm: '2026-08-20T12:00:00Z', publicandoTela: true },
            { identidade: 'bia-d4e5f6', nome: 'Bia', entrouEm: '2026-08-20T12:05:00Z', publicandoTela: false },
          ],
        },
      },
    })
    montar(<Admin />, '/admin')

    const ana = (await screen.findByText('Ana')).closest('li')
    expect(within(ana as HTMLElement).getByText('compartilhando tela')).toBeInTheDocument()

    const bia = screen.getByText('Bia').closest('li')
    expect(within(bia as HTMLElement).queryByText('compartilhando tela')).not.toBeInTheDocument()
  })
})
