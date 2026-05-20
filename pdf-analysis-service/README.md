# PDF Analysis Service

Сервис проверки PDF-документов на соответствие требованиям к шрифтам (ГОСТ и другие стандарты).

## Возможности

- Проверка шрифтов по имени, кеглю и цвету с индивидуальными допусками
- Проверка нумерации страниц по ГОСТ (арабские цифры, центр снизу, без точки, сквозная)
- Проверка подписей рисунков по ГОСТ (формат, длинное тире, центрирование, сквозная нумерация, без точки)
- Список игнорируемых шрифтов (например, символьные)
- Подробный отчёт с номером страницы, координатами (`bbox`) и фрагментом текста
- Модульная архитектура: легко добавить новый валидатор

## Структура проекта

```
pdf-analysis-service/
├── main.py                          # Точка входа
├── gost_config.json                 # Конфигурация по умолчанию
├── requirements.txt
├── config/
│   └── settings.py                  # Config, AllowedFont
├── core/
│   ├── interfaces.py                # BaseValidator (ABC)
│   ├── models.py                    # TextSpan, ParsedDocument, ValidationError
│   └── parser.py                    # PDFParser (PyMuPDF)
├── services/
│   └── validation_service.py        # ValidationService, ValidationReport
└── validators/
    ├── font_validator.py             # FontValidator
    ├── page_number_validator.py      # PageNumberValidator
    └── figure_caption_validator.py  # FigureCaptionValidator
```

## Установка

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Требуется Python 3.10+.

## Запуск

```bash
# С конфигурацией по умолчанию (gost_config.json)
python main.py /path/to/document.pdf

# С произвольным конфигом
python main.py /path/to/document.pdf my_config.json
```

Если `gost_config.json` не найден, применяется встроенный дефолт: шрифт `TimesNewRomanPSMT` 14pt чёрный.

## Конфигурация

Файл `gost_config.json` описывает допустимые шрифты и исключения:

```json
{
  "allowed_fonts": [
    {
      "name": "TimesNewRomanPSMT",
      "size": 14,
      "color": [0, 0, 0],
      "size_tolerance": 0.5,
      "color_tolerance": 35
    },
    {
      "name": "TimesNewRomanPS-BoldMT",
      "size": 14,
      "color": [0, 0, 0],
      "size_tolerance": 0.5,
      "color_tolerance": 35
    },
    {
      "name": "ArialMT",
      "size": 12,
      "color": [0, 0, 0]
    }
  ],
  "ignore_fonts": ["SymbolMT"]
}
```

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `name` | string | — | Имя шрифта (без учёта регистра) |
| `size` | float | — | Кегль в пунктах |
| `color` | [R, G, B] | — | Цвет текста (0–255 на канал) |
| `size_tolerance` | float | `0.0` | Допустимое отклонение кегля, пт |
| `color_tolerance` | int | `0` | Допустимое отклонение по каждому RGB-каналу |

Шрифты из `ignore_fonts` пропускаются при проверке.

## Пример вывода

```
✗ Найдено ошибок: 3 (FONT_VALIDATION_ERROR: 2, PAGE_NUMBER_ERROR: 1) на 85 стр.

  [FONT_VALIDATION_ERROR] [страница 74] «pred»: ожидалось=[TimesNewRomanPSMT 14.0pt ...], найдено=TimesNewRomanPSMT 9.12pt (0, 0, 0)
  [PAGE_NUMBER_ERROR] [страница 3]: номер «3» не найден в центре нижней части страницы
  [PAGE_NUMBER_ERROR] [страница 15]: номер страницы указывается без точки, найдено «15.»
```

При отсутствии ошибок:

```
✓ Документ соответствует требованиям (85 стр.)
```

## Валидаторы

### FontValidator
Проверяет каждый текстовый спан на соответствие одному из разрешённых шрифтов из `gost_config.json`.
Сравнивает имя шрифта, кегль и цвет с заданными допусками.

### PageNumberValidator
Проверяет нумерацию страниц по ГОСТ:

| Правило | Проверка |
|---|---|
| Арабские цифры, сквозная нумерация | номер спана == номер страницы |
| Центр нижней части страницы | отклонение по X ≤ 70 pt от середины; Y ≥ 88% высоты страницы |
| Без точки | `«15.»` → ошибка |
| Титульный лист без номера | числовой спан внизу стр. 1 → ошибка |
| Лист с содержанием = стр. 2 | ожидается «2» на второй странице |

### FigureCaptionValidator
Проверяет подписи рисунков по ГОСТ. Строки из PDF реконструируются из спанов (несколько span'ов на одной визуальной строке объединяются по близости Y-координат).

| Правило | Проверка |
|---|---|
| Формат | `Рисунок N — Наименование` (заглавная «Р», номер, тире, текст) |
| Тире | обязательно длинное «—» (U+2014); en-dash «–» и дефис «-» → ошибка |
| Без точки в конце | `«Рисунок 1 — Название.»` → ошибка |
| Сквозная нумерация | 1, 2, 3, … по порядку появления в документе |
| Центрирование | отклонение центра строки от центра страницы ≤ 70 pt |

## Добавление валидатора

1. Создайте класс, унаследованный от `core.interfaces.BaseValidator`.
2. Реализуйте методы `validate(document)` и свойство `name`.
3. Передайте экземпляр в `ValidationService(validators=[..., MyValidator()])` в `main.py`.

## Зависимости

| Пакет | Версия |
|---|---|
| [PyMuPDF](https://pymupdf.readthedocs.io/) | 1.27.2.3 |
