import { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProvedorDeSessao } from './sessao/sessao'
import { Admin } from './telas/Admin/Admin'
import { Entrada } from './telas/Entrada'
import { Inicio } from './telas/Inicio'

// A sala carrega o SDK do LiveKit inteiro — quase todo o peso do bundle. Separá-la deixa a
// tela de convite (a primeira que qualquer pessoa abre, às vezes no celular e na rua) e o
// painel de admin subirem sem pagar por ele.
const Sala = lazy(() => import('./telas/Sala/Sala').then((modulo) => ({ default: modulo.Sala })))

const cache = new QueryClient({
  defaultOptions: {
    queries: {
      // Um convite expirado não melhora com insistência, e o painel de admin responde 404 de
      // propósito fora do host certo — repetir só atrasaria a explicação.
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
              <Route path="/c/:token" element={<Entrada />} />
              <Route path="/sala" element={<Sala />} />
              <Route path="/admin" element={<Admin />} />
              {/* O backend devolve o index.html para qualquer rota fora de `/api`, então quem
                  resolve "não existe" é este roteador. */}
              <Route path="*" element={<Inicio />} />
            </Routes>
          </Suspense>
        </ProvedorDeSessao>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
