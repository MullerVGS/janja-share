# Imagem única: o Nest serve a API e o bundle do SPA na mesma origem.
# Mesma origem aqui não é economia de container — é o que deixa o front falar com /api sem
# precisar de CORS nenhum.

# ── frontend ───────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

# ── backend ────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS backend
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

# ── runtime ────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend /app/node_modules ./node_modules
COPY --from=backend /app/dist ./dist
COPY --from=backend /app/package.json ./package.json
# `dist/publico` é onde o Nest procura o bundle do SPA.
COPY --from=frontend /app/dist ./dist/publico
USER node
CMD ["node", "dist/main.js"]
