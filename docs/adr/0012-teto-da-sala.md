# 0012 — O bitrate é da Sala, não de quem compartilha

Status: aceito
Registro: 2026-09-30

## Contexto

O governador (ADR 0004) buscava o teto de bitrate pelo **uplink de quem compartilha**: 85% da banda medida, até 50 Mb/s. A aba Qualidade ainda oferecia um slider de "bitrate de partida" com o mesmo topo, e quem mexia nele punha no máximo.

Mas o gargalo de uma Sala é o **downlink de quem assiste**. O SFU faz o fan-out e cada Pessoa recebe todas as Telas no ar ao mesmo tempo. Numa Sala real com duas Telas, os logs do SFU mostraram quem assistia com 5–10 Mb/s de capacidade estimada recebendo 12–24 Mb/s: congestionamento contínuo, retransmissões pedidas tarde demais e vídeo travando para todos. A voz dos espectadores só segurava a subida com perda, desvio ou recepção parada — e, com SVC, o SFU entregava camada menor sem perda nenhuma, então nada segurava.

## Decisão

1. **Orçamento da Sala.** Cada espectador tem um orçamento de descida fixo (`ORCAMENTO_DA_SALA_KBPS`, 10 Mb/s) que a soma das Telas no ar tem de caber. O teto de cada Tela é o orçamento dividido pelas Telas no ar, contando a própria (`tetoDaSala`). Ele limita a busca do governador, o perfil efetivo — mesmo com o automático desligado — e a publicação, para a segunda Tela não nascer somando por cima da primeira.
2. **Sem controle de bitrate.** O slider sai da aba Qualidade. O teto de partida é sempre o do preset do conteúdo, e o valor gravado nas preferências é ignorado na leitura, sem descartar o resto do perfil.
3. **Camada cortada segura a subida.** Espectador recebendo altura abaixo de 0,9 da enviada é o SFU dizendo que o downlink dele não comporta a camada cheia. Isso segura a subida, mas não autoriza descer: o SFU já resolveu aquele espectador, e subir só aumentaria o quadro-chave de cada troca de camada.

## Consequências

- Uma Tela sozinha raramente passa de 10 Mb/s, mesmo em link simétrico bom. É o preço de caber no downlink de quem assiste; 1080p60 em VP9 cabe nisso.
- Com várias Telas, cada uma fica com menos, e a linha de estado diz "no teto da sala" em vez de "no teto do link".
- O orçamento é constante, não medido. O navegador não expõe a banda de descida quando o SFU usa estimativa do lado de quem envia (`availableIncomingBitrate` fica vazio), e a camada cortada é o sinal que sobra do lado de quem assiste.
