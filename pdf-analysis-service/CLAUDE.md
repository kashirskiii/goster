# pdf-analysis-service

FastAPI + PyMuPDF. Валидаторы документов на соответствие ГОСТ.

## Точки входа

- `api.py` — HTTP-сервис (`POST /validate`, `GET /health`). **Используется
  analysis-api в production**.
- `main.py` — CLI для ручных прогонов: `python main.py <pdf> [config.json]`.

## Структура

```
config/settings.py            Config, AllowedFont — правила из gost_config.json
core/
  interfaces.py               BaseValidator (ABC)
  models.py                   TextSpan, ParsedDocument, ValidationError, Severity
  parser.py                   PDFParser (PyMuPDF) — спаны/шрифты/координаты
  toc_parser.py               Парсинг оглавления
services/validation_service.py   ValidationService.validate(pdf) → ValidationReport
validators/
  font_validator.py           Шрифт/кегль/цвет
  page_number_validator.py    Нумерация страниц по ГОСТ
  figure_caption_validator.py Подписи рисунков
  toc_validator.py            Соответствие оглавления и страниц
  structural_heading_validator.py  Заголовки разделов
```

## Ответ /validate

```json
{
  "document": "...", "page_count": 103,
  "is_valid": false, "total_errors": 2, "total_warnings": 61,
  "checks": [
    { "validator": "FontValidator", "is_valid": false,
      "error_count": 2, "warning_count": 0,
      "issues": [{ "severity": "ERROR" | "WARNING",
                   "type": "FONT_VALIDATION_ERROR",
                   "page": 74, "message": "...",
                   "bbox": [x0,y0,x1,y1] }] }
  ]
}
```

`analysis-api` парсит этот JSON в `Check.report` (целиком) + `CheckError[]`
(на каждый `issue`).

## Что важно

- Валидаторы складываются в pipeline в `api.py::_build_service()` и
  `main.py::main()`. **Если добавляете валидатор — зарегистрируйте в обоих местах.**
- `Severity` — `ERROR` или `WARNING`. `is_valid = (errors == 0)`, warnings
  не блокируют approval.
- Конфиг шрифтов — `gost_config.json`. Ключ `font_validator.allowed_fonts` —
  массив правил с допусками `tolerance` (size/colour).

## Docker

Контейнер запускается через `uvicorn api:app --host 0.0.0.0 --port 8000`.
Healthcheck — `GET /health`. Образ собирается из этого каталога; в
docker-compose это сервис `pdf-analysis`.

## Тесты

Сервис покрывается smoke-тестом из `analysis-api/README.md`: реальный
прогон `test1.pdf` (103 страницы) → ожидаем 2 ошибки + 61 warning. Это
интеграционный sanity-check, который ловит регрессии валидаторов.
