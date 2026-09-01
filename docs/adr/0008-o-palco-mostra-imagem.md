# 0008 — O palco mostra imagem, não presença

Status: aceito
Registro: 2026-09-01

## Contexto

O palco era uma grade com um retângulo por Pessoa e um por Tela. Quem não abriu a câmera aparecia como um retângulo do tamanho de uma Tela com duas iniciais dentro. Numa sala típica — uma Tela no ar e o resto ouvindo — a maior parte do palco mostrava iniciais, e a Tela, que é o motivo da sala existir, dividia espaço com elas.

## Decisão

Só o que tem imagem ocupa o palco: Telas publicadas e câmeras abertas. Cada uma é um Quadro. Presença sem imagem vive na faixa de avatares do topo e na barra lateral, onde caber é barato.

Havendo Quadros, um deles está sempre em destaque e os outros ficam em miniaturas; sem nenhum, o palco diz que não há imagem no ar. O clique único no destaque alterna a imersão: a moldura inteira — topo, controles, miniaturas e barra lateral — sai de cena na hora, e o Quadro fica com a janela toda. Qualquer movimento do ponteiro traz a moldura de volta por alguns segundos; o duplo clique continua sendo a tela cheia do navegador.

## Consequências

`foco.chave: null` passou a significar "sem escolha da Pessoa", e quem desenha resolve o padrão (o primeiro Quadro) — não existe mais o estado "grade" para cair. `clicouNoPalco` e `soltoPelaPessoa` saíram de `foco.ts`: sem grade, não há para onde voltar nem clique no vazio.

Quem só ouve não some da sala; muda de lugar. Ganhar visibilidade agora custa abrir a câmera ou a tela — o mesmo preço para todo mundo.
