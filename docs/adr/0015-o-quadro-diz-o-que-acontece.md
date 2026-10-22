# 0015 — O quadro diz o que está acontecendo com a Tela

Status: aceito
Registro: 2026-10-22

## Contexto

Quem assiste só tinha um aviso no quadro: o do cão de guarda para a Tela que **nunca** chegou. O resto era imagem parada ou sumida sem explicação. A Tela muda (o navegador de quem compartilha pausou a captura) saía do Palco; a Tela que terminava levava o quadro embora e o destaque pulava para outra; e a Tela que chegava e depois travava era tratada como "parada legítima" — documento parado, ninguém mexendo —, então nada a socorria. O conserto que as pessoas encontraram foi o F5.

A premissa da "parada legítima" não se sustenta: o Chrome reenvia o último quadro de uma tela parada pelo menos uma vez por segundo, e o Firefox captura em taxa constante. Uma Tela viva não passa segundos sem entregar um byte; silêncio longo é a assinatura que travou.

## Decisão

1. **O vigia ganha a fase "congelada".** Uma Tela que já entregou e fica `ESPERA_PARA_CONGELAR_MS` (6 s) sem byte nenhum congela: o vigia reassina em ciclos, como na fase "nunca chegou", e depois de três tentativas espera o "Tentar de novo", que reassina na hora. Qualquer byte devolve a Tela a `ok`.
2. **Pausada não é defeito.** A Tela muda continua no Palco, marcada como pausada; a leitura pausada não conta para o vigia.
3. **Um estado por quadro, em ordem de explicação** (`estadoDoQuadro`): a minha conexão caída; a Tela que terminou; a conexão de quem compartilha caída (`ConnectionQuality.Lost` medida pelo SFU); pausada; e o que o cão de guarda viu (chegando, nunca chegou, congelada). Cada estado tem um cartão com texto próprio por cima da imagem.
4. **A Tela que termina em destaque deixa o quadro.** A peça fica no Palco com a mesma chave, sem imagem, dizendo que terminou, até alguém fechar, olhar outra Tela ou a mesma Pessoa voltar a compartilhar — e aí o destaque volta sozinho para ela.

## Consequências

- A Tela que trava depois de chegar se recupera sem F5 e sem depender de quem compartilha.
- Se algum navegador passar a ficar segundos sem enviar nada numa tela parada, o quadro dirá "parou de chegar" e reassinará à toa; a premissa do reenvio a 1 Hz é o ponto a observar.
- Telas pausadas ocupam quadro e miniatura em vez de sumir: o Palco não muda de forma quando alguém minimiza a janela.
- O ADR 0004 continua: o governador decide a qualidade de quem compartilha; o cão de guarda só cuida de a imagem chegar a quem assiste.
