# 0003 — Pipeline próprio de mídia

Status: aceito
Registro: 2026-08-25, retrospectivo

## Contexto

O Compartilhamento exige controle fino da captura, áudio da Tela, publicação, troca de fonte e interface. Os helpers de tela e componentes React do LiveKit escondem partes desse ciclo.

## Decisão

Usar `livekit-client` diretamente e manter a captura com as APIs WebRTC do navegador. Não adotar `@livekit/components-react` nem o helper de compartilhamento de tela do SDK.

## Consequências

O frontend assume mais código e testes de mídia, mas controla integralmente o Compartilhamento. Voz, câmera e chat por data channel permanecem capacidades auxiliares do mesmo cliente.
