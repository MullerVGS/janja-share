# 0018 — A Sala fala com quem não está olhando

Status: aceito
Registro: 2026-10-22

## Contexto

A aba do janja-share passa a maior parte do tempo em segundo plano: a pessoa compartilha e volta ao que estava fazendo, ou deixa a Sala aberta enquanto espera a turma. Ninguém via alguém começar uma Tela, chegar ou mandar mensagem. E a aba esquecida deixava a Sala acordada por horas (102 salas com uma pessoa sozinha por mais de 1 h depois do encontro, nas métricas).

## Decisão

1. **Título da aba com estado**: `(não lidas) ● ao vivo · <Sala> · janja-share`, cada parte só quando vale.
2. **Sons curtos sintetizados** com Web Audio — nenhum arquivo de som no projeto: notas senoidais curtas, subindo para chegar ou começar e descendo para sair ou terminar, duas notas a mais para Tela. Um som por mudança, na ordem do que mais importa (Tela começou, Tela terminou, alguém entrou, alguém saiu); entrada e saída só com até 25 pessoas; a foto da Sala ao conectar não toca nada. Ligar, desligar e volume ficam nas preferências do painel da pessoa.
3. **Sozinho e parado**: sozinho na Sala, um cartão diz isso e oferece copiar o link. Sozinho e sem Tela por 30 min, a Sala pergunta "Ainda está aí?"; sem resposta em 2 min, a pessoa sai — e a Sala fixa adormece como em qualquer saída.
4. **Voz**: falar com o microfone fechado mostra "Você está silenciado(a)!" junto do botão por 2,5 s, no máximo a cada 2 min. A escuta é de um clone da faixa do microfone, ligado só para medir o nível — e só existe para quem já abriu o microfone nesta Sala (fechar é mutar a faixa, que segue capturando). A tecla M abre e fecha o microfone com a aba em foco e fora de campo de texto. Ensurdecer cala o som da Sala para esta pessoa e fecha o microfone junto.

## Consequências

Quem nunca abriu o microfone não recebe o aviso de silenciado: abrir o microfone só para escutar pediria uma permissão que a pessoa não deu. A tecla M não usa modificador porque os atalhos com Ctrl/⌘+Shift colidem com os do navegador.
