# 0010 — A Sala não tem câmera

Status: aceito
Registro: 2026-09-06

## Contexto

O janja-share existe para compartilhar tela. A câmera entrou como capacidade auxiliar ao lado de voz e chat (ADR 0003) e ganhou lugar no Palco como Quadro (ADR 0008). Na prática ninguém a usa: as salas são tela com voz. O botão só servia para pedir ao navegador uma permissão de que a Sala não precisa e para insinuar uma videochamada que o produto não é.

## Decisão

A câmera sai. Só a Tela publica imagem: o Quadro é sempre uma Tela, e o Palco não tem quadro de Pessoa. O grant do token restringe as fontes publicáveis a microfone, tela e som da tela (`canPublishSources`), então é o SFU quem recusa a câmera — um cliente antigo em cache, ou modificado, não a publica.

## Consequências

Somem o botão, a permissão de câmera e os ramos do Palco que só existiam para ela: espelho da própria imagem, quadro sem zoom, iniciais no lugar do vídeo, foco em Pessoa. `Peca` continua distinguindo Tela de Pessoa porque a barra lateral e o controle de som separam voz de som da tela. Voltar atrás é um ADR novo, não um toggle.
