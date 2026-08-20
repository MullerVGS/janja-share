import { ehRotaDoCliente } from '../src/shared/http/spa'

describe('ehRotaDoCliente', () => {
  it('reconhece rotas normais do cliente', () => {
    expect(ehRotaDoCliente('GET', '/sala/jogatina')).toBe(true)
    expect(ehRotaDoCliente('GET', '/')).toBe(true)
    expect(ehRotaDoCliente('HEAD', '/sala/jogatina')).toBe(true)
  })

  it('exclui /api/* mesmo em caixa alta', () => {
    expect(ehRotaDoCliente('GET', '/api/config')).toBe(false)
    expect(ehRotaDoCliente('GET', '/API/config')).toBe(false)
    expect(ehRotaDoCliente('GET', '/Api/Salas')).toBe(false)
  })

  it('exclui /api bare (sem nada depois)', () => {
    expect(ehRotaDoCliente('GET', '/api')).toBe(false)
  })

  it('exclui barra repetida antes de api', () => {
    expect(ehRotaDoCliente('GET', '//api/salas')).toBe(false)
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
    expect(ehRotaDoCliente('POST', '/sala/jogatina')).toBe(false)
    expect(ehRotaDoCliente('DELETE', '/')).toBe(false)
  })

  it('exclui caminho com extensão (asset que sumiu do build)', () => {
    expect(ehRotaDoCliente('GET', '/assets/app.js')).toBe(false)
    expect(ehRotaDoCliente('GET', '/favicon.ico')).toBe(false)
  })
})
