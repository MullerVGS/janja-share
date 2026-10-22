# 0014 — A queda devolve a Tela

Status: aceito
Registro: 2026-10-22

## Contexto

O ADR 0007 fez a sala religar sozinha quando o SDK desiste, mas aceitou um custo: religar cria uma Pessoa nova no SFU, e o Compartilhamento que estava no ar precisava ser reiniciado pelo seletor do navegador. Com o padrão do SDK (`stopLocalTrackOnUnpublish: true`), a desistência despublicava **e parava** a captura — a sala voltava, a Tela não, e o atalho que as pessoas aprenderam foi o F5 (263 saídas e voltas em menos de 30 s em 61 dias de logs).

A captura não precisa morrer. Ela é da página, não da conexão: a `MediaStreamTrack` continua viva depois que a publicação some, e o navegador segue mostrando que a pessoa compartilha.

## Decisão

1. **A sala não para faixa ao despublicar.** O `Room` nasce com `stopLocalTrackOnUnpublish: false`. Quem para uma faixa é o app, de propósito: "Parar" despublica a Tela e o som dela com `unpublishTrack(faixa, true)`, e não pelo `setScreenShareEnabled(false)` do SDK, que usaria o padrão da sala. Sair da sala (`disconnect()`) continua parando tudo.
2. **O que a queda tirou do ar fica guardado.** O SDK despublica tudo numa passada síncrona que termina no `Disconnected`; as faixas despublicadas nessa passada, ainda vivas, ficam guardadas com as opções da publicação.
3. **A religação devolve o que ficou guardado**, na mesma ordem (a Tela antes do som dela), sem abrir o seletor. Captura que acabou durante a queda não volta; som de tela sem a Tela também não. O que não volta é parado.
4. **Desistir de vez para o que estava guardado**: sessão vencida, Sala encerrada, identidade tomada por outra aba ou a pessoa saindo.
5. Enquanto a sala está caída com a Tela guardada, o aviso de queda diz que a tela volta sozinha.

## Consequências

- Uma queda de rede longa termina com a Tela no ar, sem a pessoa fazer nada. Para quem assiste é uma publicação nova (outro `trackSid`), como já era a religação.
- Todo caminho que despublica a Tela por vontade da pessoa tem de pará-la explicitamente; um `unpublishTrack` sem o segundo argumento deixa a captura viva e órfã.
- A Pessoa continua sendo outra no SFU depois de religar (ADR 0007); o que muda é só que o Compartilhamento sobrevive a ela.
