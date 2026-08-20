import { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProvedorDeSessao } from './sessao/sessao'
import { Inicio } from './telas/Inicio/Inicio'

// A sala carrega o SDK do LiveKit inteiro — quase todo o peso do bundle. Separá-la deixa a
// lista de salas (a primeira tela que qualquer pessoa abre) subir sem pagar por ele.
const Sala = lazy(() => import('./telas/Sala/Sala').then((modulo) => ({ default: modulo.Sala })))

const cache = new QueryClient({
  defaultOptions: {
    queries: {
      // Uma sala que sumiu ou uma senha errada não melhoram com insistência — repetir só
      // atrasaria a explicação. A lista de salas religa `refetchOnWindowFocus` na própria
      // query, onde uma aba viva de fato se beneficia disso.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={cache}>
      <BrowserRouter>
        <ProvedorDeSessao>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/sala/:slug" element={<Sala />} />
              {/* O backend devolve o index.html para qualquer rota fora de `/api`, então quem
                  resolve "não existe" é este roteador. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ProvedorDeSessao>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
