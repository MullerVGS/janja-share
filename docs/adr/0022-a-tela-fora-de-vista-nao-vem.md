# 0022 — A Tela fora de vista não vem

Status: aceito
Registro: 2026-10-24

## Contexto

A saída do SFU é espectadores × Telas × bitrate. O teto da Sala (ADR 0012) limita o que cada espectador recebe, não o total que sai do servidor, e cada espectador recebia todas as Telas alheias na qualidade cheia: a do foco, as da pilha (ADR 0021) e as de uma aba esquecida em segundo plano. Nas noites cheias a saída encostava no limite do link e a perda de pacote chegava a metade do que se mandava.

Camada menor para a miniatura não existe. O SDK do LiveKit publica a Tela VP9/AV1 com uma camada espacial só (`L1T3`: no Chrome, SVC espacial em captura de tela derruba a resolução), e H.264/VP8 saem sem simulcast. Medido numa bancada com o LiveKit 1.13.5: pedir `VideoQuality.LOW` não muda nada; pedir menos fps descarta camadas temporais, mas a camada base carrega de 37% a 80% da banda e o SFU nem sempre atende o pedido. Pausar a assinatura (`setEnabled(false)`) zera o que chega, para qualquer codec, e religar devolve a imagem em ~150 ms mais uma ida e volta.

## Decisão

- **A Tela alheia fora de vista é pausada na assinatura.** Fora de vista é: na pilha com a pilha escondida (a pilha segue a interface flutuante e some com o ponteiro parado), ou com a aba da Sala escondida. A Tela em foco na janelinha (PiP) está à vista mesmo com a aba escondida; na grade, com a aba à vista, todas estão. A regra é `aVista.ts`; quem aplica é `useTelasAVista`.
- **Voltar à vista religa na hora; sair espera um respiro**: 15 s para a pilha e 60 s para a aba. Cada religada pede um quadro-chave a quem compartilha, e ele vai para a Sala inteira: sem o respiro, cada mexida de mouse viraria uma rajada.
- **A pausa vale por faixa.** Refazer a assinatura (cão de guarda, "Recarregar mídia") devolve o SFU ao padrão, mandando, enquanto o SDK lembra a pausa e não a repete; a faixa nova é o sinal para pedi-la de novo.
- **O relato leva a pausa** (`emPausa`). O governador de quem compartilha não lê o silêncio de quem pausou como espectador sofrendo, o cão de guarda trata a Tela pausada como pausada, e "Como chega" mostra a pessoa como "fora de vista". Ela continua contando entre quem assiste.
- Não muda nada em quem compartilha nem em "deixar de ver", que desassina de vez.

## Consequências

Numa bancada com 3 Telas VP9 e um espectador, o que chega caiu de 7,0 Mbps para 1,2 Mbps com a pilha escondida, e para zero com a aba escondida. A miniatura mostra o último quadro enquanto a pilha está escondida e volta ao vivo quando ela aparece. Mexer o mouse depois do respiro custa um quadro-chave por Tela da pilha.

A afirmação de que "com SVC o SFU dá uma camada menor ao espectador lento" não vale para Telas: só há camadas temporais. Quem mexer no governador deve partir disso.
