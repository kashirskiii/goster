# analysis-api

REST API системы проверки студенческих работ на соответствие ГОСТ.  
NestJS + Prisma + PostgreSQL + pgAdmin, полностью контейнеризировано через Docker.

## Stack


| Слой           | Технология                      |
| -------------- | ------------------------------- |
| Framework      | NestJS 11                       |
| ORM            | Prisma 5                        |
| База данных    | PostgreSQL 15                   |
| DB Admin       | pgAdmin 4                       |
| Runtime        | Node 20 Alpine                  |
| Аутентификация | JWT (access + refresh, ротация) |
| Документация   | Swagger / OpenAPI               |


## Быстрый старт

```bash
# 1. Скопировать env и при необходимости скорректировать
cp .env.example .env

# 2. Собрать и запустить все сервисы
docker compose up -d --build

# 3. Проверить состояние контейнеров
docker compose ps
```

## Сервисы


| Сервис     | URL / порт                                                       |
| ---------- | ---------------------------------------------------------------- |
| NestJS API | [http://localhost:3000/api](http://localhost:3000/api)           |
| Swagger UI | [http://localhost:3000/api/docs](http://localhost:3000/api/docs) |
| pgAdmin    | [http://localhost:5050](http://localhost:5050)                   |
| PostgreSQL | localhost:5432                                                   |


### pgAdmin — вход

- **Email:** [admin@admin.com](mailto:admin@admin.com)  
- **Password:** admin  
- Сервер `analysis-postgres` зарегистрирован автоматически — ручная настройка не нужна.

## API

### Auth (`/api/auth`)


| Метод | Путь            | Описание                                          |
| ----- | --------------- | ------------------------------------------------- |
| POST  | `/auth/login`   | Вход — возвращает пару access/refresh токенов     |
| POST  | `/auth/refresh` | Обновление токенов (старый refresh аннулируется)  |
| POST  | `/auth/logout`  | Выход — аннулирует refresh token (требует Bearer) |


### Dialogs (`/api/dialogs`)


| Метод | Путь       | Описание                                              |
| ----- | ---------- | ----------------------------------------------------- |
| POST  | `/dialogs` | Создать диалог + загрузить файл v1 (multipart, до 20 МБ). Запускает первый pipeline. |


### Submissions (`/api/submissions`, `/api/dialogs/:id/submissions`)

Каждый submission = отдельный pipeline-run (как в GitLab MR).


| Метод | Путь                                | Описание                                                  |
| ----- | ----------------------------------- | --------------------------------------------------------- |
| POST  | `/dialogs/:dialogId/submissions`    | Загрузить новую версию работы — стартует новый pipeline   |
| GET   | `/dialogs/:dialogId/submissions`    | Все версии в диалоге (для участников диалога)             |
| GET   | `/submissions/:id`                  | Детали submission: файлы, check-summary, approvals        |
| GET   | `/submissions/:id/check`            | Полный отчёт автоматической ГОСТ-проверки                 |
| POST  | `/submissions/:id/approval`         | Решение преподавателя: approved \| rejected (+ comment)   |


Интерактивная документация со всеми схемами запросов и ответов — **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**.

## Pipeline (как Merge Request в GitLab)

Поток после загрузки submission:

```
POST /dialogs (или /dialogs/:id/submissions)
   │
   ├─ создаются: Submission, File, Check(pending), Approval[system, teacher](pending)
   │  → ответ возвращается клиенту немедленно
   │
   └─ background: ChecksService.runForSubmission()
        ├─ Check.status = processing
        ├─ POST file → pdf-analysis-service:8000/validate
        ├─ сохранить CheckError[] + полный report (Json)
        ├─ Check.status = done | failed
        └─ Approval[system].status = approved (errors=0) | rejected
```

Преподаватель отдельно ставит `Approval[teacher]` через `POST /submissions/:id/approval` —
независимо от автоматической проверки.

## Доменная модель

```
User (student | teacher)
 └─ Dialog (open → approved | rejected | closed)         ≈ MR-тред
     └─ Submission (v1, v2, ...)                         ≈ pipeline-run
         ├─ File (загруженные файлы)
         ├─ Check (pending → processing → done | failed) ≈ pipeline-job
         │   └─ CheckError (нарушения: validator/code/severity/page/bbox/message)
         ├─ Message (переписка: student | teacher | system)
         └─ Approval (system | teacher: pending → approved | rejected)
                                                         ≈ MR approvals (2 шлюза)
```

`system`-approval выставляется автоматически по результату Check.
`teacher`-approval — ручной шлюз преподавателя.

## Связь с pdf-analysis-service

`PdfAnalysisClient` (`src/checks/pdf-analysis.client.ts`) ходит по HTTP в
сервис ГОСТ-валидации:

- `POST /validate` (multipart) — отправка PDF, получение JSON-отчёта
- `GET /health` — healthcheck

URL берётся из `PDF_ANALYSIS_URL` (по умолчанию `http://pdf-analysis:8000`
внутри docker-compose).

## Prisma

Выполнять внутри **запущенного** контейнера:

```bash
# Сгенерировать Prisma Client после изменений схемы
docker compose exec app npx prisma generate

# Создать и применить миграцию (dev)
docker compose exec app npx prisma migrate dev --name <migration-name>

# Применить pending-миграции (production / CI)
docker compose exec app npx prisma migrate deploy

# Открыть Prisma Studio (браузерный просмотрщик данных)
docker compose exec app npx prisma studio --browser none
# затем открыть http://localhost:5555

# Сбросить БД и перезапустить все миграции (только dev)
docker compose exec app npx prisma migrate reset

# Заполнить БД тестовыми пользователями
docker compose exec app npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Или через Makefile:

```bash
make up-build            # собрать и запустить
make prisma-generate     # сгенерировать клиент
make prisma-migrate      # создать dev-миграцию
make prisma-migrate-prod # применить prod-миграции
make prisma-studio       # открыть Studio
make prisma-reset        # сбросить БД (dev)
make logs                # логи app-контейнера
make logs-all            # логи всех контейнеров
make down                # остановить контейнеры
make down-volumes        # остановить + удалить volumes
```

### Seed-данные

После запуска seed создаются два тестовых пользователя:


| Роль    | Email                                             | Пароль           |
| ------- | ------------------------------------------------- | ---------------- |
| teacher | [teacher@example.com](mailto:teacher@example.com) | teacher-password |
| student | [student@example.com](mailto:student@example.com) | student-password |


## Smoke-тест pipeline

Прогоняет полный сценарий: dialog v1 → автоматическая проверка → решение преподавателя →
загрузка v2 → новый pipeline. Проверяет связку `analysis-api` ↔ `pdf-analysis-service`.

### Предусловия

```bash
# из корня /Users/user/Desktop/project (там единый docker-compose.yml)
docker compose up -d --build

# дождаться healthy
docker compose ps

# схема БД (если первый запуск — таблиц ещё нет)
docker compose exec -T app npx prisma db push

# тестовые пользователи (seed.ts требует ts-node, в prod-образе его нет — поэтому inline-вариант)
docker compose exec -T app node -e "
const bcrypt = require('bcrypt');
const { PrismaClient, UserRole } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const [t, s] = await Promise.all([
    bcrypt.hash('teacher-password', 10),
    bcrypt.hash('student-password', 10),
  ]);
  await p.user.upsert({ where: { email: 'teacher@example.com' }, update: {},
    create: { email: 'teacher@example.com', name: 'Teacher User', role: UserRole.teacher, passwordHash: t } });
  await p.user.upsert({ where: { email: 'student@example.com' }, update: {},
    create: { email: 'student@example.com', name: 'Student User', role: UserRole.student, passwordHash: s } });
  await p.\$disconnect();
})();
"
```

### Сам тест

```bash
API=http://localhost:3000/api
PDF1=/Users/user/Desktop/project/pdf-analysis-service/test1.pdf
PDF2=/Users/user/Desktop/project/pdf-analysis-service/test2.pdf

# 1. Логин студента
TOKEN=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"student-password"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

# 2. Логин преподавателя (teacherId берём из JWT-токена через jwt.io или из БД)
TEACHER_TOKEN=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"teacher-password"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

TEACHER_ID=$(docker compose exec -T postgres psql -U postgres -d analysis_db -tAc \
  "SELECT id FROM users WHERE email='teacher@example.com'")

# 3. Создаём диалог + v1 → стартует первый pipeline
RESP=$(curl -s -X POST $API/dialogs \
  -H "Authorization: Bearer $TOKEN" \
  -F "teacherId=$TEACHER_ID" \
  -F "title=Курсовая работа" \
  -F "comment=v1" \
  -F "file=@$PDF1")
DIALOG_ID=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['dialog']['id'])")
SUB_ID=$(echo "$RESP"  | python3 -c "import sys,json;print(json.load(sys.stdin)['submission']['id'])")
echo "dialog=$DIALOG_ID  submission=$SUB_ID"

# 4. Polling до завершения проверки
for i in $(seq 1 20); do
  ST=$(curl -s -H "Authorization: Bearer $TOKEN" \
       $API/submissions/$SUB_ID/check \
       | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
  echo "[$i] check.status=$ST"
  [ "$ST" != "pending" ] && [ "$ST" != "processing" ] && break
  sleep 3
done

# 5. Итоговый отчёт + approvals
curl -s -H "Authorization: Bearer $TOKEN" $API/submissions/$SUB_ID | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('version=', d['version'], '  check=', d['check']['status'],
      '  errors=', d['check']['errorCount'], '  warnings=', d['check']['warningCount'])
for a in d['approvals']:
    print(f'  approval {a[\"type\"]:8s}: {a[\"status\"]} — {a[\"comment\"]}')"

# 6. Преподаватель ставит решение
curl -s -X POST $API/submissions/$SUB_ID/approval \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"rejected","comment":"Исправь шрифт на стр. 74"}' | python3 -m json.tool

# 7. Загружаем v2 → новый pipeline в том же диалоге
RESP2=$(curl -s -X POST $API/dialogs/$DIALOG_ID/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -F "comment=v2 — учёл замечания" \
  -F "file=@$PDF2")
SUB2_ID=$(echo "$RESP2" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "submission v2 = $SUB2_ID"

for i in $(seq 1 20); do
  ST=$(curl -s -H "Authorization: Bearer $TOKEN" \
       $API/submissions/$SUB2_ID/check \
       | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
  echo "[$i] v2 check.status=$ST"
  [ "$ST" != "pending" ] && [ "$ST" != "processing" ] && break
  sleep 3
done

# 8. Список всех версий с агрегатом
curl -s -H "Authorization: Bearer $TOKEN" $API/dialogs/$DIALOG_ID/submissions | python3 -c "
import sys, json
for s in json.load(sys.stdin):
    appr = {a['type']: a['status'] for a in s['approvals']}
    print(f\"v{s['version']:>2}  check={s['check']['status']:>8s}  err={s['check']['errorCount']:>2}  warn={s['check']['warningCount']:>2}  system={appr.get('system')}  teacher={appr.get('teacher')}\")"
```

### Ожидаемый результат

```
dialog=<uuid>  submission=<uuid>
[1] check.status=processing
[2] check.status=done
version= 1   check= done   errors= 2   warnings= 61
  approval system  : rejected — Найдено ошибок: 2
  approval teacher : pending — None
{
  "type": "teacher", "status": "rejected",
  "comment": "Исправь шрифт на стр. 74", ...
}
submission v2 = <uuid>
[1] v2 check.status=processing
[2] v2 check.status=done
v 2  check=    done  err= 2  warn=60  system=rejected  teacher=pending
v 1  check=    done  err= 2  warn=61  system=rejected  teacher=rejected
```

### Что проверяет тест

| Шаг | Поведение |
| --- | --- |
| 3   | `Submission`, `Check(pending)`, `Approval[system,teacher](pending)` создаются в одной транзакции, ответ приходит сразу |
| 4   | Pipeline в фоне: `Check` → `processing` → `done`, `CheckError[]` сохранены, полный JSON-отчёт в `Check.report` |
| 5   | `Approval[system]` автоматически перешёл в `rejected` из-за ошибок (или `approved` если ошибок 0) |
| 6   | Только закреплённый преподаватель может ставить approval (иначе 403) |
| 7   | Новая версия = новый независимый pipeline в том же диалоге |
| 8   | Каждая версия хранит свои собственные approvals и errors |

### Диагностика

```bash
docker compose logs -f app           # логи NestJS (включая pipeline-сообщения)
docker compose logs -f pdf-analysis  # логи Python-валидатора

# Состояние БД
docker compose exec -T postgres psql -U postgres -d analysis_db -c "
  SELECT s.version, c.status, c.error_count, c.warning_count,
         (SELECT json_agg(json_build_object('type', a.type, 'status', a.status))
          FROM approvals a WHERE a.submission_id = s.id) AS approvals
  FROM submissions s LEFT JOIN checks c ON c.submission_id = s.id
  ORDER BY s.created_at DESC LIMIT 10;"
```

## Локальная разработка (без Docker)

Требуется локальный PostgreSQL. В `.env` укажите `DATABASE_URL` с хостом `localhost`.

```bash
npm install
npm run start:dev
```

## Структура проекта

```
.
├── src/
│   ├── main.ts                        # bootstrap, Swagger setup
│   ├── app.module.ts
│   ├── swagger.config.ts
│   ├── auth/
│   │   ├── auth.controller.ts         # /auth/login, /refresh, /logout
│   │   ├── auth.service.ts            # JWT generation, bcrypt, token rotation
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   └── auth-tokens.response.dto.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   └── strategies/jwt.strategy.ts
│   ├── dialogs/
│   │   ├── dialogs.controller.ts      # POST /dialogs (multipart)
│   │   ├── dialogs.service.ts         # создание диалога + первый submission + kickoff pipeline
│   │   ├── dialogs.module.ts
│   │   └── dto/
│   ├── submissions/
│   │   ├── submissions.controller.ts  # /dialogs/:id/submissions, /submissions/:id
│   │   ├── submissions.service.ts     # новые версии + запуск pipeline
│   │   ├── file-storage.ts            # сохранение PDF на диск (uploads/...)
│   │   ├── submissions.module.ts
│   │   └── dto/
│   ├── checks/
│   │   ├── pdf-analysis.client.ts     # HTTP-клиент к pdf-analysis-service
│   │   ├── checks.service.ts          # pipeline: validate → save errors → set system approval
│   │   ├── checks.controller.ts       # GET /submissions/:id/check, POST /submissions/:id/approval
│   │   ├── checks.module.ts
│   │   └── dto/
│   └── prisma/
│       ├── prisma.module.ts           # глобальный PrismaModule
│       └── prisma.service.ts          # обёртка PrismaClient
├── prisma/
│   ├── schema.prisma                  # схема данных
│   └── seed.ts                        # тестовые пользователи
├── scripts/
│   └── generate-openapi.ts            # генерация openapi.yaml
├── pgadmin/
│   └── servers.json                   # авторегистрация сервера pgAdmin
├── Dockerfile                         # multi-stage build
├── docker-compose.yml
├── Makefile
└── .env.example
```

