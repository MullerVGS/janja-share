# 0019 — A conexão à vista: a minha, a dos outros e a do celular

Status: aceito
Registro: 2026-10-22

## Contexto

71 sessões nunca conectaram mídia, e quem tentou não teve explicação nenhuma: o app dizia "conectando…" para sempre. Quem tinha a conexão ruim do outro lado só descobria perguntando "travou aí?". No celular, 52–55% das sessões caem; a aba que vai para segundo plano tem a imagem pausada pelo sistema, e a tela do aparelho apaga no meio de uma Tela.

## Decisão

1. **O estado da minha conexão** é um rótulo curto colorido no painel de voz — "Voz conectada" (verde, com as barrinhas de sinal na cor da qualidade medida), "Conectando"/"Reconectando" (amarelo), "Desconectado" (vermelho) — e, ao clicar, uma explicação humana com os limiares (250 ms de atraso, 10% de perda) e os caminhos: ver as métricas e recarregar a mídia. Preso sem conectar por 10 s, o rótulo vira "Sem rota" e a explicação diz que a rede parece bloquear a mídia, com o que fazer. As frases moram num lugar só, `sala/estadoDaConexao.ts`.
2. **A conexão ruim de outra pessoa** aparece no quadro e na linha dela na coluna: um alerta com "pode estar com problemas para se conectar". Vale quando o SFU a perdeu (`Lost`, o único degrau que mede de fora, ADR 0015) ou quando ela mesma disse, no pulso, que a rede está fraca. A própria pessoa não vê o alerta em si — ela tem o painel de voz.
3. **Quem assiste pelo celular**: enquanto há uma Tela alheia à mostra, a tela do aparelho não apaga (Wake Lock, pedido de novo a cada volta da aba). Em aparelho de toque, a aba que volta do segundo plano com uma Tela alheia à mostra reassina a mídia sozinha e diz por quê; a religação da Sala, se ela caiu lá atrás, continua a do ADR 0007. No computador, trocar de aba não faz nada disso: lá nada é pausado, e reassinar só piscaria a imagem.

## Consequências

O "Sem rota" é um palpite pelo tempo, não um diagnóstico: o mesmo rótulo aparece com o SFU fora do ar. A explicação manda tentar outra rede porque é o caso medido; o texto mora num lugar só para mudar quando houver outro caminho (um relay, por exemplo).
