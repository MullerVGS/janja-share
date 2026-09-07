# 0005 — Acesso sem conta

Status: aceito, superado em parte pelo [0011](0011-sala-privada-sem-senha.md)
Registro: 2026-08-25, retrospectivo

## Contexto

O objetivo é reduzir a fricção para criar uma Sala e compartilhar Tela. Contas, convites e administração permanente ampliariam o produto e exigiriam identidade durável.

## Decisão

Não existem contas, convites ou painel administrativo. O acesso usa nomes e identidades efêmeras, senha opcional e freios por IP, tentativas de senha e capacidade.

## Consequências

O serviço não promete anonimato nem identidade persistente. Operadores devem dimensionar os freios e proteger a única entrada HTTP com um reverse proxy confiável.
