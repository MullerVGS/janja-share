# janja-share

Compartilhamento de tela self-hosted, sem conta, com salas e identidades efêmeras.

## Recursos

- Compartilhamento simultâneo de telas, com áudio opcional.
- Voz, câmera e chat efêmero.
- Nome de sala sugerido, com troca em um clique.
- Salas públicas ou privadas (não listadas), com senha opcional.
- Qualidade adaptada no navegador de quem compartilha.

## Requisitos

- Docker com Compose.
- Em produção: domínio, TLS e um reverse proxy confiável.
- `7881/tcp` e `7882/udp` acessíveis para mídia.

## Início rápido

```bash
cp .env.example .env
# Preencha os três segredos.

docker compose build app
docker compose up -d --wait db
docker compose up -d livekit
docker compose run --rm --no-deps app npm run migration:run:prod
docker compose up -d app
```

Abra <http://localhost:3000>. Com o SFU na sua própria máquina, descomente `SFU_IP_EXTERNO=false`
e `SFU_IP=127.0.0.1` no `.env` — sem isso o SFU anuncia o IP externo e ninguém recebe mídia.

## Em produção

O mesmo arquivo; muda o `.env`.

- `LIVEKIT_URL=wss://...` e um reverse proxy com TLS na frente do app e da sinalização.
- Proxy em Docker: `REDE_DA_BORDA=<rede-do-proxy>` e `REDE_DA_BORDA_EXTERNA=true`. Ele passa a
  alcançar o app em `http://janja-share:3000` e a sinalização em `http://janja-share-livekit:7880`,
  sem porta publicada no host.
- Proxy fora do Docker: `BIND_APP=0.0.0.0` e `BIND_LIVEKIT=0.0.0.0`.
- `7881/tcp` e `7882/udp` abertos no host, sempre — a mídia não passa pelo proxy.

O projeto não inclui reverse proxy, TLS ou TURN; veja as
[portas e opções do LiveKit](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

Issues e pull requests são bem-vindos.

## Licença

[MIT](LICENSE)
