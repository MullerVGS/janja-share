# 0004 — Governador de qualidade no cliente

Status: aceito
Registro: 2026-08-25, retrospectivo

## Contexto

A qualidade de uma Tela depende principalmente do uplink de quem compartilha e do que os espectadores realmente recebem. Um preset fixo não reage a congestionamento, travamento ou recuperação.

## Decisão

O cliente que compartilha governa a qualidade usando telemetria do `RTCRtpSender` e relatos dos espectadores. A política ajusta os parâmetros do sender; `adaptiveStream` e `dynacast` nativos ficam desativados enquanto essa política for responsável pela adaptação.

## Consequências

O comportamento fica testável e específico para Tela, ao custo de manter telemetria, protocolo de relatos e política de recuperação no frontend.
