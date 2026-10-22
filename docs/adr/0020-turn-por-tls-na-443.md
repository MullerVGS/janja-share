# 0020 — TURN por TLS na 443, com o TLS de quem está na frente

Status: aceito
Registro: 2026-10-22

## Contexto

A mídia sai direto do host em `7882/udp`, e `7881/tcp` é a alternativa. Quem está numa rede que bloqueia as duas (rede corporativa, de faculdade, alguns provedores) entra na Sala, vê a lista de Pessoas e nunca recebe uma Tela: a sinalização passa pelo proxy na 443, e a mídia não tem por onde passar. Nos logs de 61 dias do SFU foram 71 sessões assim, de 5 pessoas, uma delas com 23 tentativas.

A saída é um TURN que fale TLS na 443, a única porta que essas redes deixam passar. O LiveKit já traz um TURN embutido, autenticado pelas mesmas chaves e com credencial por Pessoa, que ele entrega ao cliente na resposta do `join`. Nem o app nem o SPA precisam saber que ele existe.

A 443 do host já pertence ao reverse proxy, que serve o app e a sinalização. O mesmo repositório roda em mais de uma casa, e uma delas não pode quebrar por causa da outra.

## Decisão

1. **TURN embutido do LiveKit, só por TLS e desligado por padrão.** `TURN_DOMINIO` liga o TURN. Vazio, as variáveis `LIVEKIT_TURN_*` do compose ficam vazias, o LiveKit as trata como ausentes e sobe sem TURN. Não há TURN/UDP: quem tem UDP aberto já usa a `7882`.
2. **O TLS é terminado por quem está na frente.** O LiveKit roda com `external_tls`: escuta TURN em TCP puro na `5349` do container e anuncia `turns:<TURN_DOMINIO>:443?transport=tcp`, com a 443 fixa no código do LiveKit. Na 443, o proxy usa um roteador TCP por SNI (`HostSNI`), termina o TLS com o certificado dele e repassa os bytes para a `5349`. Os roteadores HTTP da mesma entrada continuam com os outros nomes, porque o proxy só escolhe o roteador TCP quando o SNI é o do TURN.
3. **A porta do TURN publica onde a casa mandar.** `BIND_TURN:PORTA_TURN` vale `127.0.0.1` com porta efêmera por padrão. Assim nada colide numa casa sem TURN. Um proxy em Docker na rede da borda alcança `janja-share-livekit:5349` pelo nome, sem publicar nada. Um proxy noutra rede alcança a porta publicada no gateway da rede dele.
4. **O domínio do TURN chega direto no host.** Um CDN que só repassa HTTP não carrega TURN, por isso o nome precisa ser só DNS, sem proxy no caminho.

## Consequências

- Quem não alcança `7881` nem `7882` passa a receber e publicar mídia pela 443. O ICE só escolhe o relay quando os caminhos diretos falham, e quem tem rede boa não muda de rota.
- Cada Pessoa abre uma conexão TLS com o TURN ao entrar, mesmo que não chegue a usá-la. É uma alocação por Pessoa, o que pesa pouco.
- O relay e o SFU estão no mesmo container. O relay manda para o IP externo do SFU, e o pacote volta ao container pelo `docker-proxy`, que responde com o IP de destino original. Assim a permissão do TURN casa sem publicar a faixa de relay (30000–40000). O tráfego de quem usa TURN passa pelo `docker-proxy` em espaço de usuário, mas é uma minoria.
- O TURN vê todas as conexões vindas do proxy, nunca o IP real de quem está atrás: o TURN do LiveKit não lê PROXY protocol.
- O que se ganha é alcance, não qualidade. TCP sobre TLS sofre com perda de pacote (bloqueio na cabeça da fila), e uma Tela pesada pelo TURN fica pior que pela `7882`. O governador (ADR 0004) e o teto da Sala (ADR 0012) seguem valendo.
- Recriar o LiveKit para ligar ou desligar o TURN derruba as Salas acordadas. As fixas voltam pelo link assinado (ADR 0013).
