# Мост к Claude: как он устроен в `asis` (NOAH)

Источник: github.com/faafaafuu/asis, коммит `6a832ed` («Qrack: у моста — выбор Claude Sonnet или Haiku»).
Локально `../asis` рядом с проектом не было, репозиторий склонирован отдельно только для чтения.

## TL;DR

«Мост» — это **OpenAI-совместимый HTTP-сервис**, который на каждый запрос запускает
**CLI подписки** (Claude Code: `claude -p`) в неинтерактивном режиме и возвращает ответ
в формате `chat/completions`. API-ключ Anthropic не нужен: оплата идёт через подписку,
под которой один раз выполнен вход в `claude` на сервере.

В `asis` мост представлен в двух местах:

| Где | Что это | Статус в репо |
|---|---|---|
| служба `noa-bridge`, `http://127.0.0.1:8791` | сервер моста на VPS | **кода в репо нет**, есть только клиент и контракт |
| `platform/server/noa.mjs` | серверный клиент моста + публичный прокси `/api/noa/bridge/*` | есть |
| `src-tauri/src/local_cli.rs` | тот же принцип без сервера: десктоп сам вызывает `claude -p` | есть, это эталон механики |
| `src/js/web/ai-web.js`, `src-tauri/src/brains.rs` | клиенты, которые выбирают мост как обычную «модель» | есть |

## 1. Контракт сервера моста (`:8791`)

Восстановлен по клиенту в `platform/server/noa.mjs`.

**Авторизация:** `Authorization: Bearer $NOA_BRIDGE_TOKEN`. Сервис слушает только `127.0.0.1`.

**`GET /v1/models`**: список движков (`claude-code-bridge`, `codex-bridge`, `gemini-bridge`, `qwen-bridge`).

**`POST /v1/chat/completions`**: тело в формате OpenAI плюс свои поля:

```jsonc
{
  "model": "claude-code-bridge",   // движок; уровень может приходить хвостом: "claude-code-bridge:haiku"
  "messages": [{ "role": "system", "content": "..." }, { "role": "user", "content": "..." }],
  "noa_model": "sonnet",           // haiku | sonnet | opus, только для Claude
  "noa_web": true,                 // разовый запрос, без общей сессии
  "noa_timeout": 300,              // необязательно, секунды для длинных ответов
  "stream": false                  // при true отдаёт SSE (text/event-stream), как OpenAI
}
```

Ответ:

```json
{ "choices": [{ "message": { "role": "assistant", "content": "..." } }] }
```

Ошибки: `{ "error": "..." }` со статусом не 2xx. Своё ожидание у моста ~180 с; клиент ждёт 200 с,
для длинных ответов `noa_timeout + 30` с. Если мост не отвечает, клиент возвращает 502.

Обёртка в `noa.mjs`:
- `bridgeUser`: мост доступен только владельцу (`NOAH_BRIDGE_USERS` + наличие токена), остальным 403.
- `bridgeChat(model, messages, long, quality, signal)`: возвращает `choices[0].message.content`,
  на пустой ответ бросает ошибку. Поддерживает отмену через `AbortSignal`.
- Окружение: `NOAH_BRIDGE_URL` (по умолчанию `http://127.0.0.1:8791`), `NOA_BRIDGE_TOKEN`, `NOAH_BRIDGE_USERS`.

## 2. Механика вызова CLI (`local_cli.rs`)

То, что сервер моста делает внутри (по коду десктопного аналога):

1. **Склейка диалога в один промпт.** У CLI нет сессии, поэтому `system`-сообщения идут первыми,
   дальше последние 12 реплик в виде `Пользователь: …` / `Ассистент: …`. Если в запросе есть
   `response_format`, в конец дописывается «Ответь только JSON, без пояснений и разметки».
2. **Запуск:** `claude -p --output-format text --strict-mcp-config`, промпт подаётся **через stdin**,
   чтобы не упереться в лимит длины командной строки. `--strict-mcp-config` нужен, чтобы MCP-серверы,
   подключённые к Claude Code, не добавляли десятки тысяч токенов описаний инструментов.
   Рабочая папка временная (`$TMP/sufler-cli`).
3. **Таймаут** 150 с, потом `kill`.
4. **Результат:** успешный код выхода и непустой stdout дают ответ. Иначе разбирается stderr: слова
   `login/auth/credential/unauthorized` означают «нужен вход», остальное возвращается первыми 300 символами.
5. **Нормализация:** ответ заворачивается в `{ model, choices: [{ message: { role, content } }] }`.

Выбор модели (`haiku`/`sonnet`/`opus`) на сервере, по всей видимости, передаётся в `claude --model <alias>`.
В `local_cli.rs` этого нет, в коде сервера не проверить: это предположение.

## 3. Известные особенности

- **Задержка.** Холодный старт CLI занимает несколько секунд, полный ответ от 5 до 60+ с. Клиенты закладывают до 200 с.
- **Один процесс на запрос:** параллельность ограничена ресурсами сервера и лимитами подписки.
- **Ошибки подписки** (`usage limit`, `session limit`, `can't receive replies`, `verification portal`)
  в `learn-app/core.js` распознаются отдельно и не повторяются.
- **JSON** мост не гарантирует: строгий режим есть только просьбой в промпте, валидация на стороне клиента.

## 4. Как это ляжет в Life Map (`packages/llm`)

```ts
interface LLMProvider {
  generateJSON<T>(schema: z.ZodType<T>, prompt: Prompt, opts?: { signal?: AbortSignal }): Promise<T>;
}
```

`ClaudeBridgeProvider`: два транспорта за одним интерфейсом, выбор через env.

| `CLAUDE_BRIDGE_MODE` | Что делает | Env |
|---|---|---|
| `http` | `POST {CLAUDE_BRIDGE_URL}/v1/chat/completions` с Bearer-токеном, как `noa.mjs` | `CLAUDE_BRIDGE_URL`, `CLAUDE_BRIDGE_TOKEN`, `CLAUDE_BRIDGE_MODEL=sonnet` |
| `cli` | `spawn("claude", ["-p","--output-format","json","--strict-mcp-config","--model",M])`, промпт в stdin, как `local_cli.rs` | `CLAUDE_BIN`, `CLAUDE_BRIDGE_MODEL` |

Общее для обоих транспортов: промпт собирается из system + user, в конец добавляется JSON Schema (из zod)
и требование «только JSON». Из ответа вырезается первый `{…}`/`[…]` (модель иногда оборачивает его в ```json),
дальше `schema.safeParse`. При ошибке один-два повтора, в которые передаётся текст ошибки валидации.
Отмена через `AbortSignal`, таймаут настраивается. Содержимое промптов и ответов в лог не пишется,
только длительность, статус и размер.

`OpenRouterProvider` использует тот же OpenAI-формат с `response_format: { type: "json_schema" }` там,
где модель это поддерживает, и тот же цикл «валидация → повтор».
