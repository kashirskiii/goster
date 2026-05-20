# prisma

`PrismaService extends PrismaClient` плюс `PrismaModule` с `@Global()`.

## Что важно

- Модуль глобальный, поэтому `PrismaService` доступен везде без импорта
  модуля. В `*.module.ts` других модулей **не импортируйте `PrismaModule`**.
- `onModuleInit` / `onModuleDestroy` вызывают `$connect`/`$disconnect`.
- Транзакции пишем через `prisma.$transaction(async tx => ...)`. Внутри
  колбэка используйте только `tx`, а не `this.prisma`, иначе запросы
  пойдут вне транзакции.

## Схема

`prisma/schema.prisma` — единая точка правды. После правок:

```bash
docker compose exec -T app npx prisma generate            # обновить @prisma/client
docker compose exec -T app npx prisma migrate dev --name <name>  # миграция
# или, для быстрых правок без миграций:
docker compose exec -T app npx prisma db push
```

Доменная модель описана в корневом `CLAUDE.md`.
