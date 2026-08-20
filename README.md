# share

Compartilhamento de tela self-hosted, sem conta, com salas e identidades efêmeras.

## Recursos

- Compartilhamento simultâneo de telas, com áudio opcional.
- Voz, câmera e chat efêmero.
- Salas com senha opcional.
- Qualidade adaptada no navegador de quem compartilha.

## Requisitos

- Docker com Compose.
- Em produção: domínio, TLS e um reverse proxy confiável.
- `7881/tcp` e `7882/udp` acessíveis para mídia.

## Início rápido

```bash
cp .env.example .env
# Preencha os três segredos do arquivo.

docker compose build app
docker compose up -d --wait db
docker compose up -d livekit
docker compose run --rm --no-deps app npm run migration:run:prod
docker compose up -d app
```

Abra <http://localhost:3000>.

Em produção, ajuste `LIVEKIT_URL` para `wss://...` e rode os mesmos comandos com
`docker compose -f docker-compose.yml -f docker-compose.prod.yml`. O projeto não inclui
reverse proxy, TLS ou TURN; veja as [portas e opções do LiveKit](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

Issues e pull requests são bem-vindos.

## Licença

[MIT](LICENSE)
