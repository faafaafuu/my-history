# Life Map (m-map)

Граф-майндмэп жизни: привычки, планы, состояния и последствия как узлы и связи.
AI предлагает следствия и связи, анализ показывает, что тянет вниз, а что вверх,
выбранное превращается в задачи, календарь и напоминания.

## Структура

| Путь | Что там |
|---|---|
| `apps/web` | Next.js (App Router) + Tailwind: UI и REST API (`/api/*`) — тот же API для iOS |
| `packages/core` | типы, zod-схемы, граф-алгоритмы; без UI-зависимостей |
| `packages/llm` | `LLMProvider`: мост к Claude и OpenRouter (этап 3) |
| `docker/` | образы web, nginx (TLS), backup |
| `docs/` | [мост](docs/bridge.md), [деплой](docs/deploy.md) |

## Запуск

```bash
cp .env.example .env        # пароль БД, домен, ключи
docker compose up -d        # web, postgres, nginx, certbot, backup
docker compose exec web node scripts/user-create.mjs you@example.com
```

Открыть `https://<DOMAIN>` (локально `https://localhost`, сертификат самоподписанный).

## Разработка

```bash
pnpm install
docker run -d --name mmap-pg -e POSTGRES_USER=mmap -e POSTGRES_PASSWORD=mmap -e POSTGRES_DB=mmap -p 5432:5432 postgres:16-alpine
pnpm db:migrate
pnpm user:create you@example.com
pnpm dev                    # http://localhost:3000 (COOKIE_SECURE=false в dev по умолчанию)
pnpm test && pnpm typecheck
```

Изменили `apps/web/src/server/db/schema.ts` → `pnpm db:generate` (CI проверяет, что миграция не забыта).

## API (этап 1)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/healthz` | процесс жив и БД отвечает |
| `GET` | `/metrics` | Prometheus; только из docker-сети `metrics` |
| `POST` | `/api/auth/login` | `{email,password}` → cookie сессии |
| `POST` | `/api/auth/token` | `{email,password,label?}` → `{token:"mm_…"}` для `Authorization: Bearer` (iOS) |
| `POST` | `/api/auth/logout` | закрыть сессию |
| `POST` | `/api/auth/register` | 403, пока `ALLOW_SIGNUP=false` |
| `GET` | `/api/me` | текущий пользователь |

Ошибки — `{ "error": "…" }` с HTTP-статусом; ошибки валидации — ещё `issues`.
