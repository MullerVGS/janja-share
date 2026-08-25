# 0006 — Visibilidade efêmera das salas

Status: aceito
Registro: 2026-08-25

## Contexto

Algumas Salas devem existir sem aparecer no saguão. Persistir essa visibilidade fora do SFU criaria um segundo catálogo para reconciliar com as Salas vivas.

## Decisão

A opção `privada` vive no metadata da encarnação da Sala no LiveKit. A listagem pública omite essas Salas, mas a entrada direta pelo slug continua disponível. Senha e visibilidade são escolhas independentes.

Metadata sem `privada`, inclusive de encarnações anteriores, significa Sala pública.

## Consequências

Sala privada significa não listada, não autenticada: quem conhece o link pode tentar entrar, e uma senha deve ser definida quando o link sozinho não for proteção suficiente. A visibilidade desaparece junto com a Sala e não exige migration nem limpeza no Postgres.
