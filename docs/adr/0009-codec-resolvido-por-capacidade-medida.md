# 0009 — Codec resolvido por capacidade medida

Status: aceito
Registro: 2026-09-01

## Contexto

O preset amarrava codec a conteúdo — `jogo` fixava H.264, com o argumento, escrito no próprio
código, de que é o caminho do encoder de hardware. Isso vale no Chrome. No Firefox em Windows o
mesmo H.264 de WebRTC cai no OpenH264 por software, e o preset que protege a CPU de quem joga num
navegador destrói a imagem no outro.

Medido em produção: um Compartilhamento em Firefox entregava 0,7 Mbps e 12 fps de um teto de 8
Mbps, com **perda de pacote zero** no uplink; outro em Chrome, na mesma Sala e na mesma noite,
empurrava 7,7 Mbps. O SFU repassou fielmente o que recebeu nos dois casos. O gargalo nascia no
encoder, e o codec era a variável.

Codec não é propriedade do conteúdo. O conteúdo pede continuidade ou nitidez de borda; qual
encoder dá conta disso é pergunta sobre a máquina. `h264` estava ali como proxy para "tem encoder
de hardware" — que é justamente o tipo de coisa que só a medição sabe.

Por baixo havia um defeito maior. O governador escutava três campos que só o Chrome fornece —
`qualityLimitationReason`, `availableOutgoingBitrate` e `powerEfficientEncoder`. Sem o primeiro,
`motivoDe` devolvia `null` para sempre: nenhum degrau descia, nenhum teto era procurado, e a UI
dizia "subindo" a transmissão inteira. No Firefox o automático não estava mal calibrado; estava
inerte.

Detectar navegador resolveria o sintoma e não o problema, e envelheceria mal a cada versão.

## Decisão

O codec sai do preset de conteúdo e passa a ser resolvido por capacidade.

`sala/capacidade.ts` escolhe o codec da partida consultando `mediaCapabilities.encodingInfo`
(tipo `webrtc`, com o sinônimo não-padrão `transmission` que o Firefox usa) filtrado por
`RTCRtpSender.getCapabilities`. Nunca lê `userAgent`. A ordem de autoridade é: a escolha da
pessoa, o que a máquina aprendeu, o palpite da API, o padrão.

Essa consulta tem um limite conhecido: o navegador responde `smooth` e `powerEfficient` para
qualquer configuração suportada enquanto não tiver estatísticas daquele aparelho. Numa máquina
fria ela é otimista por construção — teria aprovado H.264 no computador do caso acima. Por isso a
partida é palpite, e quem sabe a verdade é a telemetria.

`telemetria/limitacao.ts` infere o que limita o encoder a partir de duas razões que existem em
qualquer navegador: **aproveitamento** (quanto do bitrate autorizado o encoder usou, tendo como
denominador o teto do perfil e nunca o `targetBitrate`) e **acompanhamento** (quantos dos quadros
da fonte ele codificou). A rede é julgada primeiro e sozinha, pela perda. `motivoDe` passa a ler
`limitadoPor ?? inferido`, e o governador volta a funcionar fora do Chrome sem mudar uma linha da
lógica de degraus.

O módulo distingue **encoder apertado** de **encoder incapaz**. Sob `'cpu'` com aproveitamento
patológico, o governador troca o codec **antes** de ceder degrau — apertar o encoder não devolve
ciclo de CPU nenhum, trocar o encoder devolve. Sob `'cpu'` com o encoder apenas apertado, a
escada de degraus continua sendo a resposta: trocar o codec de quem já está no codec certo
custaria um pisca para não ganhar nada.

A correção é **uma por transmissão**, porque republica a faixa e pisca ~1 s para a Sala. O
vencedor é gravado em `codecAprendido`, o que transforma "corrige uma vez por transmissão" em
"erra uma vez na vida".

O automático escolhe apenas entre VP9, H.264 e VP8; AV1 continua disponível só por escolha
manual, para que ninguém fique sem imagem por uma decisão que a máquina tomou sozinha. O padrão
é VP9, pela assimetria do custo de errar: errar para VP9 numa máquina com H.264 por hardware
gasta mais CPU e é invisível; errar para H.264 numa máquina sem ele deixa a transmissão
inassistível.

Codec passa a ter um dono só. `definirPerfil` cuida do pedido e `definirCodecPreferido` cuida do
codec — enquanto o preset o carregava havia duas portas para a mesma decisão, e elas discordavam:
uma gravava a intenção e a outra não, então reiniciar a transmissão devolvia o automático por
cima de uma escolha explícita.

## Consequências

O governador funciona fora do Chrome, o que antes não acontecia — e esse é o ganho maior, não o
codec.

Uma transmissão pode piscar uma vez, cedo, quando a correção age; a UI explica o que houve e
oferece Desfazer. A troca não entra em `decisoes`: aquele registro é do eixo cedido, e misturar
codec ali repetiria o defeito que o ADR do gráfico já evita.

Os limiares da inferência estão calibrados por um único caso observado e vivem como constantes
exportadas, para ajuste quando aparecer o segundo. O aprendizado pode gravar o veredicto de um
dia atípico — uma máquina ocupada com outra coisa — e o erro dura algumas transmissões até a
próxima correção; o override manual sempre vence. E uma correção infeliz vale pela transmissão
inteira: não há segunda tentativa automática, e a saída é manual.
