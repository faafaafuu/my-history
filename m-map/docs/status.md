# Статус проекта и передача работы

Файл для следующей сессии Claude Code: прочитать его первым, вместе с ТЗ ниже.

## Согласовано с владельцем

- Проект живёт в `m-map/` репозитория `faafaafuu/my-history`, ветка `claude/serene-dirac-agsrur`.
- **Авторизация** сделана по схеме asis, а не через Auth.js: scrypt, сессии в БД (sha256), HttpOnly-cookie `mm_session`,
  Bearer-ключи `mm_…` для iOS. Регистрация закрыта, пользователь создаётся через `scripts/user-create.mjs`.
- **LLM:** по умолчанию `LLM_PROVIDER=bridge` (мост к подписке Claude, `docs/bridge.md`), запасной —
  `LLM_FALLBACK=openrouter` с моделью из `OPENROUTER_MODEL`. Ключи вписываются только в `.env` на сервере,
  в чат их не присылать.
- Сервер владельца — тот же, где NOAH (`84.247.166.53`). Порты 80, 443 и 8443 заняты другими сайтами:
  Life Map ставить на свободные (предложено 9080/9443). Домена пока нет, сертификат самоподписанный.
- Мост `noa-bridge` работает на этом же сервере (`127.0.0.1:8791`, токен `NOA_BRIDGE_TOKEN` в его
  файле окружения). Из контейнера loopback хоста недоступен: варианты описаны в `docs/deploy.md` → «Мост к Claude».
- Skill frontend-design недоступен; дизайн делать по ТЗ: тёмная тема, glass-эффект, свечение узлов.

## Сделано

| Этап | Статус |
|---|---|
| 0. Мост изучен, `docs/bridge.md` | ✅ |
| 1. Каркас, БД (10 таблиц, userId везде), auth, Compose (web/postgres/nginx/certbot/backup), CI, `/healthz`, `/metrics`, бэкапы | ✅ проверено в песочнице; на сервере ещё не разворачивалось |
| 2. Холст | ⏭ следующий |

Тесты: `packages/core` — 13, `apps/web` — 6. Проверка: `pnpm typecheck && pnpm test`.

## Следующие шаги

1. **Развернуть на сервере** (см. `docs/deploy.md`):
   - `cp .env.example .env`, выставить `HTTP_PORT`/`HTTPS_PORT` на свободные порты (проверить `ss -ltnp`),
     задать `POSTGRES_PASSWORD` (`openssl rand -hex 16`);
   - `docker compose up -d --build`;
   - создать пользователя: `docker compose exec web node scripts/user-create.mjs <почта>` (пароль спросит без эха, ввести его должен владелец).
2. **Найти мост:** `systemctl status noa-bridge`, на каком адресе он слушает, где лежит его env-файл с токеном.
   Выбрать способ подключения и прописать `CLAUDE_BRIDGE_URL` и `CLAUDE_BRIDGE_TOKEN` в `.env`.
   Прочитать исходник моста на сервере и уточнить `docs/bridge.md`: как передаётся `noa_model` → `--model`.
3. **Этап 2 — холст:** React Flow + d3-force, CRUD узлов и рёбер через `/api/nodes` и `/api/edges` с фильтром по userId,
   визуал по ТЗ, 60 fps на 300+ узлах.
4. Дальше этапы 3–6 по ТЗ. После каждого — короткий отчёт и тесты на `packages/core`.

## Подводные камни

- nginx слушает только IPv4: на машинах без IPv6 он падал.
- `/metrics` через nginx закрыт (404): docker подменяет IP клиента, и фильтр по адресу пропускал всех.
- backup стартует после `web: healthy`, иначе первый дамп получался пустым, без схемы.
- Изменили `schema.ts` → выполнить `pnpm db:generate`, CI проверяет, что миграция не забыта.
