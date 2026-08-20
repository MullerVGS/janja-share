import { ehRotaDoCliente } from '../src/shared/http/spa'

describe('ehRotaDoCliente', () => {
  it('reconhece rotas normais do cliente', () => {
    expect(ehRotaDoCliente('GET', '/sala')).toBe(true)
    expect(ehRotaDoCliente('GET', '/admin')).toBe(true)
    expect(ehRotaDoCliente('GET', '/c/abc123')).toBe(true)
    expect(ehRotaDoCliente('GET', '/')).toBe(true)
    expect(ehRotaDoCliente('HEAD', '/sala')).toBe(true)
  })

  it('exclui /api/* mesmo em caixa alta', () => {
    expect(ehRotaDoCliente('GET', '/api/config')).toBe(false)
    expect(ehRotaDoCliente('GET', '/API/config')).toBe(false)
    expect(ehRotaDoCliente('GET', '/Api/Admin/Convites')).toBe(false)
  })

  it('exclui /api bare (sem nada depois)', () => {
    expect(ehRotaDoCliente('GET', '/api')).toBe(false)
  })

  it('exclui barra repetida antes de api', () => {
    expect(ehRotaDoCliente('GET', '//api/admin/convites')).toBe(false)
    expect(ehRotaDoCliente('GET', '///api/config')).toBe(false)
  })

  it('não confunde /apix ou /apiado com /api', () => {
    expect(ehRotaDoCliente('GET', '/apix')).toBe(true)
    expect(ehRotaDoCliente('GET', '/apiado/coisa')).toBe(true)
  })

  it('não confunde /foo/api/bar (api no meio do caminho) com o prefixo do servidor', () => {
    expect(ehRotaDoCliente('GET', '/foo/api/bar')).toBe(true)
  })

  it('exclui métodos diferentes de GET/HEAD, mesmo em rota de cliente', () => {
    expect(ehRotaDoCliente('POST', '/sala')).toBe(false)
    expect(ehRotaDoCliente('DELETE', '/admin')).toBe(false)
  })

  it('exclui caminho com extensão (asset que sumiu do build)', () => {
    expect(ehRotaDoCliente('GET', '/assets/app.js')).toBe(false)
    expect(ehRotaDoCliente('GET', '/favicon.ico')).toBe(false)
  })
})
