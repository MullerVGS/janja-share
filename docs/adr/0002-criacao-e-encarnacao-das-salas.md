# 0002 — Criação e encarnação das salas

Status: aceito
Registro: 2026-08-25, retrospectivo

## Contexto

Tokens do LiveKit continuam válidos depois que uma Sala expira. Reusar diretamente seu nome permitiria que um token antigo entrasse em uma nova Sala homônima.

## Decisão

Somente a API cria salas e o `auto_create` do LiveKit fica desativado. Cada encarnação recebe um nome interno opaco no formato `<slug>-<nonce>`; o slug público permanece único apenas entre salas vivas.

## Consequências

O mesmo slug pode ser reutilizado com segurança após a expiração. Tokens antigos não recriam nem acessam a nova encarnação.
