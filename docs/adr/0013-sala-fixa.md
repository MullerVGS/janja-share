# 0013 — Sala fixa: o SFU guarda a Sala adormecida e o link assinado a traz de volta

Status: aceito
Registro: 2026-10-22

Altera o [0002](0002-criacao-e-encarnacao-das-salas.md), o [0006](0006-visibilidade-efemera-das-salas.md)
e o [0011](0011-sala-privada-sem-senha.md); mantém o [0001](0001-livekit-como-autoridade-das-salas.md).

## Contexto

A Sala morria 120 s depois de o último sair. Mas os grupos voltam: nove em cada dez voltam em até
sete dias, e os mais fiéis criavam Sala e link novos toda noite, mandando o convite de novo. Abrir
um link de Sala morta dava um 404 seco, sem saída. Guardar a Sala exigiria um catálogo — e o app
não tem banco desde o 0011, e o SFU é a verdade sobre as Salas (0001).

## Decisão

1. **O SFU segura a Sala.** A Sala fixa nasce com `departureTimeout` de 7 dias; a efêmera, com os
   120 s de sempre. O LiveKit conta esse prazo a partir da última saída, então cada encontro empurra
   a guarda adiante sozinho. O `emptyTimeout` (antes da primeira entrada) não muda. `fixa` vive no
   metadata da encarnação, como `privada`; metadata sem `fixa` é a efêmera.
2. **Fixa é o padrão.** A efêmera é a opção "Apagar quando todos saírem" (`fixa: false`).
3. **O link leva uma assinatura** (`?k=<carga>.<mac>`). A carga é legível — nome, privada e
   validade em base64url — e o MAC é um HMAC-SHA256 de 16 bytes sobre slug, nome, privada, fixa e
   validade. A chave sai do `LIVEKIT_API_SECRET` por HKDF com o rótulo
   `janja-share/assinatura-do-link/v1`: nenhuma variável nova, e quem tem esse segredo já cria
   qualquer Sala direto no SFU, então a assinatura não dá poder novo a ninguém. Trocar o rótulo
   revoga todos os links sem trocar o segredo. A validade é 7 dias mais 1 de folga (o tempo dentro
   da Sala), e cada entrada emite uma assinatura nova.
4. **A assinatura só pesa quando a Sala não está no SFU.** Com a Sala viva (acordada ou adormecida),
   `POST /api/salas/:slug/entrar` entra pelo slug como antes. Sem ela, uma assinatura que confere e
   está no prazo **recria** a Sala — encarnação nova, nonce novo — com mesmo slug, nome e
   visibilidade. Sem assinatura, o 404 é `sala_nao_existe`; com uma adulterada, `assinatura_invalida`;
   vencida, `sala_expirada`. Recriar paga o freio de criar e respeita os tetos; pedidos simultâneos
   do mesmo slug viram uma encarnação só.
5. **Tetos.** As 20 Salas do teto contam só as acordadas (com gente, ou efêmeras na carência). As
   adormecidas têm teto próprio de 200 (`muitas_guardadas`), que só barra a fixa.
6. **Saguão.** Lista as públicas acordadas; a adormecida não aparece para ninguém. O nome dela
   continua ocupado até ela expirar. "Suas salas" é memória deste navegador (`localStorage`): as
   Salas fixas visitadas, acordadas ou adormecidas, com entrar em um clique.
7. **Nome e visibilidade mudam depois de criar** (`PATCH /api/salas/:slug`), por qualquer Pessoa
   presente — o token do LiveKit da encarnação atual, com a identidade dele dentro da Sala agora.
   O servidor grava o metadata novo na mesma encarnação, e o SFU o entrega a todos
   (`RoomMetadataChanged`): é assim que quem está dentro recebe o link novo. Privada que muda de
   nome guarda o sufixo; pública que vira privada ganha um. O slug antigo vai para `anteriores` no
   metadata, e só um link **assinado** dele leva à Sala renomeada — sem isso, o grupo que não estava
   lá recriaria a Sala antiga pelo link velho, e o nome público antigo levaria a uma Sala agora
   privada.
8. **O link é a identidade.** Com o nome da Pessoa guardado no navegador, abrir o link entra
   direto; o formulário fica para quem nunca deu nome. A Sala que não volta mostra "Esta sala
   expirou" com "Criar de novo com o mesmo nome" (mesmo nome e visibilidade).

## Consequências

- O 0002 continua: `auto_create` desligado e um nonce por encarnação. Um token da encarnação
  anterior a um reinício do SFU não entra na recriada.
- O 0006 ganha um segundo campo efêmero no metadata (`fixa`), mais `assinatura` e `anteriores`
  depois de um ajuste. Visibilidade agora muda em vida.
- O 0011 continua sem banco. O que a Sala fixa precisa lembrar mora no SFU (a Sala adormecida),
  no link (a assinatura) e no navegador (Suas salas).
- Reiniciar o SFU perde as Salas e o `anteriores`: o link assinado de antes de uma troca de nome
  passa a recriar a Sala com o nome antigo. Também perde a guarda contada pelo LiveKit — a recriada
  ganha 7 dias novos a partir da próxima saída, dentro da validade do link.
- Link vazado de Sala privada dura enquanto a assinatura valer, e não só enquanto a Sala viver. É o
  mesmo modelo do 0011 (o link é a chave), com prazo mais longo.
- A listagem pula `listParticipants` das Salas que o SFU conta vazias, para dezenas de adormecidas
  não multiplicarem chamadas. O contador do SFU atrasa alguns segundos depois de uma entrada.
