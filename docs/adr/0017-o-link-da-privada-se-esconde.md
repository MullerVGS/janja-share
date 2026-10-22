# 0017 — O endereço da Sala privada se esconde enquanto a Tela está no ar

Status: aceito
Registro: 2026-10-22

## Contexto

A Sala privada só é alcançada por quem tem o link: o sufixo sorteado do slug é a chave (ADR 0011). Quem compartilha a tela inteira mostra junto a barra de endereço do navegador — e, com ela, a chave para quem estiver assistindo uma gravação, uma live de terceiros ou um print.

## Decisão

Enquanto a própria Tela está no ar numa Sala privada, a barra de endereço mostra `/sala/<nome>-oculta`, sem a assinatura. A troca é feita com `history.replaceState`, por fora do roteador: o app continua sabendo o slug de verdade. O endereço verdadeiro fica na `sessionStorage` da aba, e um F5 com a barra mascarada volta a ele antes do roteador ler o endereço. Parar de compartilhar, sair ou trocar de Sala devolve o endereço verdadeiro — e só se a barra ainda mostra o mascarado, para não puxar ninguém de volta.

O convite continua copiando o link inteiro; o campo do diálogo de convite diz que o link está oculto e manda usar o Copiar.

## Consequências

Copiar o endereço da barra durante o compartilhamento dá um link que não abre a Sala; o "Copiar" do convite é o caminho, e diz isso. Sem `sessionStorage`, a máscara não acontece — um F5 sem volta custaria a Sala, e esconder não vale isso.
