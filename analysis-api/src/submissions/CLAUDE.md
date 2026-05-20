# submissions

Новые версии работы (v2..N) и просмотр сабмишенов. **Каждая submission =
новый pipeline-run.**

## Эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/dialogs/:dialogId/submissions` | Загрузить новую версию |
| `GET`  | `/dialogs/:dialogId/submissions` | Все версии диалога (для участников) |
| `GET`  | `/submissions/:id`               | Детали submission |

## Инвариант

`addToDialog`:
1. Только владелец диалога (`studentId`) может добавлять — иначе 403.
2. Если `Dialog.status` уже `closed` или `approved` — 400.
3. Версия = `max(version) + 1` среди существующих сабмишенов диалога.
4. В одной транзакции создаются: `Submission` + `File` + `Check(pending)`
   + `Approval[system,teacher](pending)` + `Event(submission_added)`.
5. После транзакции `setImmediate` запускает pipeline.

## FileStorage

`file-storage.ts` — единственное место, где пишем файл на диск. Путь:
`uploads/dialogs/{dialogId}/submissions/{submissionId}/{filename}`.
Имя санируется (`[^a-zA-Z0-9._-]` → `_`), чтобы не было path-injection.

## Тесты

`submissions.service.spec.ts` покрывает критичную логику:
- ownership: чужой студент → `ForbiddenException`
- блокировка `closed` / `approved` диалогов → `BadRequestException`
- инкремент версии (next = max + 1)
- транзакция содержит submission + file + check + 2 approvals + event
- `setImmediate` вызывает `checks.runForSubmission`
