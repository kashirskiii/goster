# analysis-api

NestJS 11 + Prisma 5 + Postgres 15. Оркестратор: принимает работы студентов,
запускает pipeline (HTTP → pdf-analysis-service), хранит результаты и
approvals.

## Структура модулей

```
src/
├── auth/         JWT (access+refresh, ротация), passport-jwt
├── prisma/       глобальный PrismaService (extends PrismaClient)
├── dialogs/      создание диалога с первым submission v1
├── submissions/  новые версии (v2..N) и просмотр
└── checks/       HTTP-клиент к pdf-analysis + pipeline + teacher approval
```

## Инвариант pipeline

После `dialog.create` или `submission.add`:
- `Submission` + `File` + `Check(pending)` + `Approval[system,teacher](pending)`
  создаются **в одной транзакции**;
- `setImmediate(() => checks.runForSubmission(...))` запускает pipeline в фоне;
- эндпоинт возвращает ответ немедленно.

## Тесты

Запускать **на хосте**, не в контейнере: production-образ копирует только
`dist/`, исходников `src/` там нет.

```bash
cd analysis-api
npm test                       # все unit-тесты (Jest + ts-jest)
npm test -- checks             # фильтр по имени
npm test -- --watch            # dev-режим
```

Покрытие фокусированное — только критичная бизнес-логика:

- `src/checks/checks.service.spec.ts` — pipeline (`applyReport`, `markFailed`,
  ownership в `setTeacherApproval`, маппинг severity)
- `src/submissions/submissions.service.spec.ts` — версионирование,
  ownership, блокировка closed/approved, состав транзакции, kickoff в фоне

DTO, контроллеры, чистые мапперы тестами не покрываем — они покрываются
smoke-тестом из README.

## Gotchas

- `class-validator` не установлен и `ValidationPipe` не подключён.
  Не добавляйте декораторы валидации в DTO — они не сработают.
- Файл submission читается с диска перед отправкой в pdf-service. В
  docker-compose оба сервиса видят `uploads/` через volume `uploads_data`,
  но **сейчас файл шлётся по HTTP**, не через общий том — менять без
  необходимости не нужно.
- В production-образе нет `ts-node`, поэтому `npx prisma db seed` не работает
  (есть `seed.ts`). Для seed используйте inline-вариант из README.
- `npx tsc --noEmit` ругается на `orval.config.ts` (внешний скрипт) —
  это pre-existing шум. Для проверки сборки используйте `tsc -p tsconfig.build.json`.
