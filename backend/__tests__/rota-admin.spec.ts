import { ehRotaAdmin } from '../src/admin/rota-admin'

describe('ehRotaAdmin', () => {
  it('reconhece as rotas reais de admin', () => {
    expect(ehRotaAdmin('/api/admin/convites')).toBe(true)
    expect(ehRotaAdmin('/api/admin/convites/123')).toBe(true)
    expect(ehRotaAdmin('/api/admin/sala')).toBe(true)
    expect(ehRotaAdmin('/api/admin')).toBe(true)
  })

  it('ignora caixa', () => {
    expect(ehRotaAdmin('/API/ADMIN/convites')).toBe(true)
    expect(ehRotaAdmin('/Api/Admin/Sala')).toBe(true)
  })

  it('tolera barra repetida', () => {
    expect(ehRotaAdmin('//api/admin/convites')).toBe(true)
    expect(ehRotaAdmin('/api//admin/convites')).toBe(true)
  })

  it('não confunde /api/administracao com /api/admin', () => {
    expect(ehRotaAdmin('/api/administracao')).toBe(false)
  })

  it('rejeita rotas públicas', () => {
    expect(ehRotaAdmin('/api/config')).toBe(false)
    expect(ehRotaAdmin('/api/entrar')).toBe(false)
    expect(ehRotaAdmin('/api/convites/token123')).toBe(false)
  })

  it('rejeita a rota de front-end que só tem "admin" no path (sem /api)', () => {
    expect(ehRotaAdmin('/admin')).toBe(false)
  })
})
