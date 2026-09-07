# 0011 — Sala privada sem senha

Status: aceito
Registro: 2026-09-07

Supera a parte de senha do [0005](0005-acesso-sem-conta.md) e do
[0006](0006-visibilidade-efemera-das-salas.md), e a persistência do
[0001](0001-livekit-como-autoridade-das-salas.md).

## Contexto

Senha de sala custava um Postgres inteiro — a única tabela do projeto guardava hashes, e com ela
vinham TypeORM, migrações, um serviço no compose, um volume e dois passos no início rápido. Em
troca, protegia salas de um encontro que dura minutos.

## Decisão

Senha de sala deixa de existir. Sala privada continua sendo criada pelas opções avançadas do
diálogo e continua fora do saguão; o que a torna difícil de alcançar passa a ser o slug, que
ganha um sufixo aleatório de 6 hex (`escondida-7f3a91`). O nome exibido não muda.

Sem senha para guardar, o Postgres sai da pilha: o SFU volta a ser a única fonte de verdade e o
app não tem estado próprio.

## Consequências

O link é a chave da sala privada. Não há mais o código de erro `senha_incorreta` nem o freio de
tentativas, `GET /api/salas` não devolve mais `temSenha`, e as envs obrigatórias caem de cinco
para quatro. Os testes e2e deixam de exigir qualquer serviço externo.
