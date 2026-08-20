import { existsSync } from 'fs'
import { join, resolve, sep } from 'path'
import type { INestApplication } from '@nestjs/common'
import express from 'express'

/**
 * Entrega do frontend (SPA do Vite) pelo próprio Nest — mesma origem que a API, sem CORS.
 * Onde o bundle fica na imagem: `dist/publico`, irmão de `dist/main.js` (ver Dockerfile).
 */
export function dirPublicoPadrao(): string {
  return resolve(join(__dirname, '..', '..', 'publico'))
}

// Tolerante a barra(s) repetida(s) antes de "api" (`//api/...`) e a caixa (`/API/...`): o
// Express casa rota ignorando os dois, então este fallback — que roda como middleware cru,
// ANTES do router do Nest — precisa reconhecer a mesma coisa como "API" ou vira uma forma de
// contornar o prefixo /api inteiro (e, com ele, a guarda de admin). Um `startsWith` simples
// deixava passar `/API/admin/convites` como se fosse rota de cliente, devolvendo a casca HTML
// no lugar do JSON — ou, pior, da guarda.
const PREFIXO_API = /^\/+api(\/|$)/i
const TEM_EXTENSAO = /\.[a-z0-9]+$/i

/**
 * O fallback do SPA devolve `index.html` para caminhos que só o React Router conhece
 * (`/c/:token`, `/sala`, `/admin`). Três exclusões:
 * - só GET/HEAD: POST em rota inexistente é erro, não navegação;
 * - nada sob `/api` (qualquer caixa, qualquer barra repetida antes): erro de API precisa
 *   continuar JSON;
 * - nada com extensão: asset que sumiu do build tem que dar 404, não a casca do app com
 *   `Content-Type: text/html` (o erro apareceria como "Unexpected token '<'" no console).
 */
export function ehRotaDoCliente(metodo: string, caminho: string): boolean {
  if (metodo !== 'GET' && metodo !== 'HEAD') return false
  if (PREFIXO_API.test(caminho)) return false
  return !TEM_EXTENSAO.test(caminho)
}

/**
 * Monta a entrega do frontend. Devolve `false` sem montar nada quando não há bundle no caminho
 * informado — estado normal em desenvolvimento (Vite serve o app à parte) e nos testes.
 *
 * Registrar antes do `listen()` põe estes middlewares à frente das rotas do Nest, que só
 * entram no Express durante o `init()`. Sem conflito: `express.static` chama `next()` para o
 * que não é arquivo, e o fallback ignora tudo que é do servidor.
 */
export function montarSpa(app: INestApplication, dirPublico = dirPublicoPadrao()): boolean {
  const indice = join(dirPublico, 'index.html')
  if (!existsSync(indice)) return false

  app.use(
    express.static(dirPublico, {
      index: false,
      setHeaders(res, caminho) {
        const imutavel = caminho.includes(`${sep}assets${sep}`)
        res.setHeader('Cache-Control', imutavel ? 'public, max-age=31536000, immutable' : 'no-cache')
      },
    }),
  )

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!ehRotaDoCliente(req.method, req.path)) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indice)
  })

  return true
}
