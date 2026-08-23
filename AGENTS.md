# AGENTS.md

Instruções para agentes que desenvolvem o janja-share.

## Começo obrigatório

1. Leia `CONTEXT.md`.
2. Liste sempre `docs/adr/` com `rg --files docs/adr`.
3. Abra somente os ADRs pertinentes à alteração atual.

## Mapa

- `backend/`: API NestJS, regras das salas e integração com LiveKit/Postgres.
- `frontend/`: SPA React, captura, recepção e controle da mídia.
- `infra/`: configuração do LiveKit.
- `docs/adr/`: decisões arquiteturais.

## Comandos

```bash
cd backend && npm test && npm run typecheck
cd frontend && npm test && npm run typecheck && npm run build
docker compose config
```

Use Node.js 22 ou superior. Para e2e, suba Postgres e LiveKit e rode `npm run test:e2e` no backend.

## Regras de trabalho

- Preserve o vocabulário de `CONTEXT.md`.
- Decisões arquiteturais novas ou alteradas viram ADR; não duplique arquitetura no README.
- Mudança de comportamento atualiza testes. Bug ganha reprodução quando viável.
- Documentação, configuração e mudanças mecânicas não exigem testes novos; valide o que afetarem.
- Rode testes, typecheck e build proporcionais à alteração.
- Mantenha documentação em PT-BR e identificadores técnicos no idioma existente.
- Não registre infraestrutura ou operação de um ambiente particular no repositório.
