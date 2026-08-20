import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { esquecerONavegadorFalso } from './navegador'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  esquecerONavegadorFalso()
  // A sessão da sala mora no `sessionStorage`; sem limpar, um teste entraria na sala do anterior.
  sessionStorage.clear()
})
