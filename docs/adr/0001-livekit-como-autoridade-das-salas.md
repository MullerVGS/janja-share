# 0001 — LiveKit como autoridade das salas

Status: aceito
Registro: 2026-08-25, retrospectivo

## Contexto

Salas são efêmeras. Persistir sua presença, participantes ou telas publicadas criaria estado concorrente com o SFU e exigiria reconciliação.

## Decisão

O LiveKit é a autoridade sobre salas vivas, Pessoas presentes e Telas publicadas. O Postgres persiste somente o hash de senha de salas protegidas.

## Consequências

A disponibilidade da listagem depende do LiveKit. Hashes órfãos são removidos quando o nome de uma Sala é reutilizado.
