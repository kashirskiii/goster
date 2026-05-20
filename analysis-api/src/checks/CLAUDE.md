# checks

Pipeline (= автоматическая проверка ГОСТ) и решение преподавателя.

## Состав

```
pdf-analysis.client.ts   HTTP-клиент к pdf-analysis-service (POST /validate)
checks.service.ts        Сервис: runForSubmission, setTeacherApproval, find
checks.controller.ts     GET /submissions/:id/check, POST /submissions/:id/approval
```

## ChecksService.runForSubmission — pipeline

Не пробрасывает исключения наружу. Любой сбой → `Check.status=failed` +
`Approval[system].status=rejected` с причиной.

```
load Submission(+file,+check)
  ├─ no submission → log + return
  ├─ no check      → log + return  (защита от рассинхрона)
  ├─ no file       → markFailed("Файл сабмишена отсутствует")
  ├─ Check.status = processing, started_at = now
  ├─ Event(check_started)
  ├─ pdf-analysis.validate(absolutePath, originalName)
  │     ├─ ok    → applyReport(report)
  │     └─ throw → markFailed(error.message)
  └─ ──
```

`applyReport` (в одной транзакции):
- `deleteMany(check_errors)` — переиграть результат, если pipeline
  перезапускался;
- `createMany(CheckError[])` — каждый issue из всех `report.checks[].issues`;
- `Check.status=done`, `report=<full json>`, `errorCount`, `warningCount`,
  `pageCount`, `failureReason=null`;
- `Approval[system].upsert` — `approved` если `report.is_valid`, иначе `rejected`.

После транзакции — `Event(check_completed)`.

## ChecksService.setTeacherApproval

Защита: только `Dialog.teacherId` может ставить approval. `status` должен
быть `approved` или `rejected` (не `pending`). Upsert по
`(submissionId, type=teacher)` — преподаватель может пересмотреть решение.

## PdfAnalysisClient

- `baseUrl` из `PDF_ANALYSIS_URL` (default `http://localhost:8000`).
- Таймаут из `PDF_ANALYSIS_TIMEOUT_MS` (default 60s, AbortController).
- При не-2xx бросает `Error("pdf-analysis-service <status>: <body>")`.
- `health()` — best-effort, возвращает `boolean`, не бросает.

## Тесты

`checks.service.spec.ts` покрывает критичную логику:
- `applyReport` — корректное преобразование report → CheckError[],
  `Approval[system]=approved` при `is_valid=true`, `=rejected` иначе;
- `markFailed` при ошибке HTTP-клиента (mock throws) — `Check.status=failed`,
  `Approval[system]=rejected`;
- `setTeacherApproval` — 404 для несуществующей, 403 для чужого преподавателя,
  отказ на `status=pending`;
- `runForSubmission` — корректно обрабатывает submission без файла;
- маппинг `WARNING` → `ErrorSeverity.warning`, `ERROR` → `error`.
