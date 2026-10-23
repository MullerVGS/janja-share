# 0021 — O palco é das Telas

Status: aceito
Registro: 2026-10-23

## Contexto

O ADR 0016 trouxe a Pessoa de volta ao palco como quadro, do mesmo tamanho que a Tela, e pôs os quadros fora de foco numa faixa embaixo. A métrica de uso diz que o janja-share é de tela: o microfone abre em 4,5% das sessões, e quase toda Sala existe para alguém mostrar alguma coisa. Com uma Tela no ar, os avatares de quem só assiste dividiam a grade com ela, e a faixa embaixo encolhia a Tela em foco para caber uma fileira de iniciais. O botão "Mostrar quem não compartilha" consertava isso à mão, toda vez.

## Decisão

- **Com alguma Tela no ar, só Telas são quadros.** Quem não compartilha continua na coluna de salas (com o contorno de quem fala e o microfone), mas sai do palco. Sem Tela nenhuma, a chamada volta a ser a grade de quem está na Sala, como no 0016. A regra mora em `palcoEmCena`, e é esse palco que `decidirFoco` recebe: a Pessoa em foco cede à Tela que entra no ar.
- **A faixa vira pilha.** Em foco, o quadro fica com o palco inteiro e os outros quadros se empilham, pequenos, no canto de cima à direita, por cima da imagem e abaixo do cabeçalho. A pilha segue a interface flutuante: some com o ponteiro parado junto do cabeçalho e da barra, e volta com ele — também na imersão, onde antes os outros quadros sumiam de vez. Escondida, ela sai da ordem do teclado e da leitura de tela.
- **Tela nova dos outros não rouba o foco** (como antes): ela aparece na pilha. A própria Tela nova continua indo ao foco.
- O botão "Mostrar quem não compartilha" sai do cabeçalho: o que ele fazia virou a regra.

## Consequências

A Tela em foco ganha a altura que a faixa ocupava. A pilha cobre um canto da imagem enquanto o ponteiro mexe — o preço de não encolher a Tela; parado, a imagem fica inteira.

Revisa o ADR 0016 na presença como quadro durante um Compartilhamento e na faixa do foco; o resto da casca segue.
