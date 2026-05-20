# dialogs

Создание диалога (= MR-тред) с первой версией работы.

## Эндпоинт

`POST /dialogs` (multipart) — студент создаёт диалог + загружает PDF v1.
Создаёт `Dialog` + `Submission(v1)` + `File` + `Check(pending)` +
`Approval[system,teacher](pending)` в одной транзакции, событие
`dialog_created` + `submission_added`. Запускает pipeline в фоне через
`ChecksService.runForSubmission`.

## Дизайн

- ID-ы (`dialogId`, `submissionId`) генерируются `randomUUID()` **до**
  записи в БД, чтобы файл уже лежал на диске к моменту коммита.
- Файл сохраняем через общий `FileStorage` из `submissions/` — не
  дублируем логику.
- Дополнительные сабмишены (v2..N) **не идут через этот модуль**, для них
  есть `submissions/`.

## Что важно

- Перед созданием диалога проверяем что `teacherId` существует и имеет
  роль `teacher` — иначе 400.
- Pipeline запускается **после** коммита транзакции (`setImmediate`), не
  внутри. Иначе фоновая задача увидит несуществующий submission.

## Тесты

Не покрыты unit-тестами — основной флоу совпадает с
`SubmissionsService.addToDialog`, который покрыт. Сценарий "создать
диалог с невалидным teacher" покрывается smoke-тестом и Swagger UI.
