# 0015 — O quadro diz o que está acontecendo com a Tela

Status: aceito
Registro: 2026-10-22

## Contexto

Quem assiste só tinha um aviso no quadro: o do cão de guarda para a Tela que **nunca** chegou. O resto era imagem parada ou sumida sem explicação. A Tela muda (o navegador de quem compartilha pausou a captura) saía do Palco; a Tela que terminava levava o quadro embora e o destaque pulava para outra; e a Tela que chegava e depois travava era tratada como "parada legítima" — documento parado, ninguém mexendo —, então nada a socorria. O conserto que as pessoas encontraram foi o F5.

Do lado de quem assiste, as duas paradas são idênticas: nenhum byte chegando. Uma fonte sem quadro novo — o documento parado, a janela que não repinta — não manda nada (verificado no Chrome com uma fonte que para de pintar; o reenvio periódico do modo de tela do WebRTC não vale aqui, porque a faixa vai com `contentHint: 'motion'`). Só quem compartilha sabe se o encoder está mandando bytes.

## Decisão

1. **Quem compartilha pulsa.** A cada 2 s, quem tem Tela no ar manda à Sala inteira, pelo data channel e sem garantia de entrega (tópico `pulso-da-tela`), se o encoder mandou bytes nas últimas amostras. Um pulso vale 5 s.
2. **O vigia ganha a fase "congelada".** Uma Tela que já entregou e fica `ESPERA_PARA_CONGELAR_MS` (6 s) sem byte nenhum **enquanto o dono pulsa que está mandando** congela: o vigia reassina em ciclos, como na fase "nunca chegou", e depois de três tentativas espera o "Tentar de novo", que reassina na hora. Qualquer byte devolve a Tela a `ok`; o dono calado (ou sem pulso válido) devolve a congelada a parada.
3. **Pausada não é defeito.** A Tela muda continua no Palco, marcada como pausada; a leitura pausada não conta para o vigia.
4. **Um estado por quadro, em ordem de explicação** (`estadoDoQuadro`): a minha conexão caída; a Tela que terminou; a conexão de quem compartilha caída (`ConnectionQuality.Lost` medida pelo SFU); pausada; e o que o cão de guarda viu (chegando, nunca chegou, congelada). Cada estado tem um cartão com texto próprio por cima da imagem.
5. **A Tela que termina em destaque deixa o quadro.** A peça fica no Palco com a mesma chave, sem imagem, dizendo que terminou, até alguém fechar, olhar outra Tela ou a mesma Pessoa voltar a compartilhar — e aí o destaque volta sozinho para ela.

## Consequências

- A Tela que trava depois de chegar se recupera sem F5 e sem depender de quem compartilha.
- O congelamento depende do pulso: se o data channel de quem compartilha também cair, não há congelamento a declarar — mas aí a conexão do dono costuma aparecer como caída, e o quadro diz isso.
- O pulso é mais um tráfego por Tela no ar, de dezenas de bytes a cada 2 s.
- Telas pausadas ocupam quadro e miniatura em vez de sumir: o Palco não muda de forma quando alguém minimiza a janela.
- O ADR 0004 continua: o governador decide a qualidade de quem compartilha; o cão de guarda só cuida de a imagem chegar a quem assiste.
