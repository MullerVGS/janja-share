import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O Nest serve este bundle em produção, na mesma origem da API. O dev usa proxy para fingir a
// mesma coisa — é o que mantém `/api` relativo nos dois ambientes. `changeOrigin: false`
// preserva o header `Host` original da requisição em vez de reescrevê-lo para o alvo do proxy.
const BACKEND = process.env.SHARE_API ?? 'http://localhost:3000'

const config = {
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.spec.{ts,tsx}'],
    setupFiles: ['./__tests__/apoio/preparo.ts'],
    css: true,
  },
}

export default defineConfig(config)
