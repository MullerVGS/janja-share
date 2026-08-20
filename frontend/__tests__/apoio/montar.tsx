import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ProvedorDeSessao } from '../../src/sessao/sessao'

function cacheDeTeste() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

export function montar(elemento: ReactNode, rota = '/') {
  return render(
    <QueryClientProvider client={cacheDeTeste()}>
      <MemoryRouter initialEntries={[rota]}>
        <ProvedorDeSessao>{elemento}</ProvedorDeSessao>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
