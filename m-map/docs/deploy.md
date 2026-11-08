# Деплой на свой сервер

Docker Compose + nginx + Let's Encrypt. Без облаков и Terraform.

## Первый запуск

```bash
git clone … && cd m-map
cp .env.example .env
# DOMAIN=life.example.com
# LETSENCRYPT_EMAIL=you@example.com
# POSTGRES_PASSWORD=$(openssl rand -base64 24)
docker compose up -d
docker compose exec web node scripts/user-create.mjs you@example.com
```

DNS-запись `DOMAIN` должна указывать на сервер, порты 80 и 443 открыты.

## Сервисы

| Сервис | Что делает |
|---|---|
| `postgres` | PostgreSQL 16, том `pgdata`, наружу не опубликован |
| `web` | Next.js; при старте применяет миграции, потом сервер. Healthcheck: `/healthz` |
| `nginx` | TLS, редирект 80→443, rate limit (`/api/auth/*` 10/мин, `/api/*` 20/с), `/metrics` закрыт |
| `certbot` | выпуск и продление сертификата (webroot), проверка раз в час |
| `backup` | `pg_dump -Fc` по `BACKUP_CRON` (по умолчанию 03:15 UTC), хранит `BACKUP_KEEP_DAYS` (14) дней |

### TLS

Пока сертификата нет, nginx стартует с самоподписанным, поэтому `docker compose up`
не зависит от Let's Encrypt. Certbot выпускает настоящий сертификат через
`/.well-known/acme-challenge/`, nginx раз в час проверяет и подхватывает его (`reload`).
Чтобы проверить выпуск без лимитов LE, поставьте `LETSENCRYPT_STAGING=1`.

## Бэкапы

Дампы лежат в `BACKUP_DIR` (по умолчанию `./backups`, права 700). Каталог не должен
быть доступен из веба. Желательно копировать его на другую машину, например
`rsync` по cron.

Восстановление:

```bash
docker compose stop web
docker compose exec -T postgres pg_restore -U mmap -d mmap --clean --if-exists < backups/mmap-YYYYMMDD-HHMMSS.dump
docker compose start web
```

## Метрики (Prometheus / Grafana)

`web:3000/metrics` отдаёт стандартные метрики Node и гистограммы
`mmap_http_request_duration_seconds{route,method,status}` и
`mmap_llm_request_duration_seconds{provider,prompt,outcome}`.

Через nginx `/metrics` не отдаётся. Если на сервере уже есть Prometheus в Docker,
подключите его к сети `m-map-metrics` (имя задаёт `METRICS_NETWORK`):

```yaml
# в compose Prometheus
networks:
  m-map-metrics:
    external: true
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: m-map
    static_configs: [{ targets: ["web:3000"] }]
    # если задан METRICS_TOKEN:
    # authorization: { credentials: "<METRICS_TOKEN>" }
```

В Grafana достаточно добавить этот Prometheus как источник данных.

## Мост к Claude

Подробности в [bridge.md](bridge.md). Если `noa-bridge` работает на этом же сервере
(слушает `127.0.0.1:8791`), контейнер его не увидит: loopback хоста изнутри
недоступен. Два варианта:

- **через площадку NOAH:** `CLAUDE_BRIDGE_URL=https://<noah>/api/noa/bridge`,
  `CLAUDE_BRIDGE_TOKEN=noah_…`. Это ключ владельца, его аккаунт должен быть в `NOAH_BRIDGE_USERS`;
- **напрямую:** мост слушает адрес docker-шлюза (`172.17.0.1:8791`),
  `CLAUDE_BRIDGE_URL=http://host.docker.internal:8791`, `CLAUDE_BRIDGE_TOKEN=$NOA_BRIDGE_TOKEN`.

## Приватность

- Ключи и токены хранятся только в `.env` (в git он не попадает).
- Содержимое узлов и промптов не логируется: ни в приложении, ни в БД-драйвере, а nginx пишет пути без query string.
- **Шифрование диска** настраивается на уровне сервера, вне Compose: LUKS на разделе
  с `/var/lib/docker` и `BACKUP_DIR`, или зашифрованный том у хостера.
- Бэкапы хранятся с правами 700 вне webroot. При копировании на другую машину их стоит шифровать (`age`/`gpg`).
