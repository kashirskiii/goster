"""
Валидатор СОДЕРЖАНИЯ по ГОСТ:
- TOC найдено на стр. 2
- Обязательные разделы присутствуют (Введение, Заключение, Список литературы)
- Номера разделов идут сквозной нумерацией без пропусков
- Номера страниц в оглавлении совпадают с реальными заголовками в тексте
"""

import re

from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, Severity, TextSpan, ValidationError

# Ключевые слова обязательных ненумерованных разделов (lowercase, начало заголовка)
_REQUIRED_SECTIONS = {
    "введение": "ВВЕДЕНИЕ",
    "заключение": "ЗАКЛЮЧЕНИЕ",
    "список": "СПИСОК ЛИТЕРАТУРЫ / СПИСОК ИСПОЛЬЗУЕМЫХ ИСТОЧНИКОВ",
}

# Шрифт, по которому распознаём заголовки в теле документа
_BOLD_MARKER = "bold"

# Допуск при сравнении страниц TOC ↔ реальный документ (±1 страница)
_PAGE_TOLERANCE = 1

# Порог похожести заголовков (доля общих слов)
_TITLE_MATCH_THRESHOLD = 0.6

_SECTION_NUM_RE = re.compile(r"^(\d+)(?:\.\d+)*$")
_LINE_Y_TOL = 3.0


class TocValidator(BaseValidator):
    @property
    def name(self) -> str:
        return "TocValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        errors: list[ValidationError] = []

        if document.toc is None:
            return [_err(
                page=1,
                bbox=(0.0, 0.0, 0.0, 0.0),
                preview="",
                expected="раздел СОДЕРЖАНИЕ присутствует в документе",
                actual="раздел СОДЕРЖАНИЕ не найден",
            )]

        toc = document.toc

        # 1. TOC должно быть на стр. 2
        if toc.toc_start_page != 2:
            errors.append(_warn(
                page=toc.toc_start_page,
                bbox=(0.0, 0.0, 0.0, 0.0),
                preview="СОДЕРЖАНИЕ",
                expected="СОДЕРЖАНИЕ на странице 2",
                actual=f"СОДЕРЖАНИЕ на странице {toc.toc_start_page}",
            ))

        if not toc.entries:
            errors.append(_err(
                page=toc.toc_start_page,
                bbox=(0.0, 0.0, 0.0, 0.0),
                preview="",
                expected="распознанные записи в СОДЕРЖАНИИ",
                actual="записи не распознаны",
            ))
            return errors

        # 2. Обязательные разделы
        titles_lower = {e.title.lower() for e in toc.entries}
        for keyword, label in _REQUIRED_SECTIONS.items():
            if not any(t.startswith(keyword) for t in titles_lower):
                errors.append(_err(
                    page=toc.toc_start_page,
                    bbox=(0.0, 0.0, 0.0, 0.0),
                    preview="",
                    expected=f"раздел «{label}» в СОДЕРЖАНИИ",
                    actual="раздел отсутствует",
                ))

        # 3. Сквозная нумерация разделов верхнего уровня
        top_numbered = [
            e for e in toc.entries
            if e.level == 0 and _SECTION_NUM_RE.match(e.number)
        ]
        expected = 1
        for entry in top_numbered:
            actual = int(entry.number)
            if actual != expected:
                errors.append(_err(
                    page=toc.toc_start_page,
                    bbox=entry.bbox,
                    preview=f"{entry.number} {entry.title[:60]}",
                    expected=f"раздел {expected} (сквозная нумерация)",
                    actual=f"раздел {actual}",
                ))
            expected = actual + 1

        # 4. Номера страниц в пределах документа
        for entry in toc.entries:
            if entry.page > document.page_count:
                errors.append(_err(
                    page=toc.toc_start_page,
                    bbox=entry.bbox,
                    preview=f"{entry.number} {entry.title[:60]}",
                    expected=f"страница в пределах документа (1—{document.page_count})",
                    actual=f"страница {entry.page}",
                ))

        # 5. Кросс-валидация: номера страниц в TOC vs реальные заголовки
        errors.extend(_cross_validate(document, toc.entries))

        return errors


# ── кросс-валидация TOC ↔ тело документа ─────────────────────────────────────

def _cross_validate(
    document: ParsedDocument,
    entries,
) -> list[ValidationError]:
    """Сравнивает номера страниц из TOC с реальным расположением заголовков."""
    errors: list[ValidationError] = []

    # Собрать все жирные строки из тела документа (заголовки)
    bold_lines = _extract_bold_lines(document)

    for entry in entries:
        if not entry.title:
            continue
        best_page = _find_heading_page(entry, bold_lines)
        if best_page is None:
            continue  # заголовок не найден — не ошибка (приложения, внешние ссылки)
        if abs(best_page - entry.page) > _PAGE_TOLERANCE:
            errors.append(_warn(
                page=best_page,
                bbox=(0.0, 0.0, 0.0, 0.0),
                preview=f"{entry.number} {entry.title[:60]}",
                expected=f"страница {entry.page} (по СОДЕРЖАНИЮ)",
                actual=f"страница {best_page} (фактическое расположение заголовка)",
            ))

    return errors


def _extract_bold_lines(document: ParsedDocument) -> list[dict]:
    """Возвращает визуальные строки, где все спаны имеют жирный шрифт."""
    # Группируем спаны в строки
    if not document.spans:
        return []

    sorted_spans = sorted(
        document.spans,
        key=lambda s: (s.page, (s.bbox[1] + s.bbox[3]) / 2, s.bbox[0]),
    )
    groups: list[list[TextSpan]] = [[sorted_spans[0]]]
    for s in sorted_spans[1:]:
        last = groups[-1][-1]
        last_cy = (last.bbox[1] + last.bbox[3]) / 2
        this_cy = (s.bbox[1] + s.bbox[3]) / 2
        if s.page == last.page and abs(this_cy - last_cy) <= _LINE_Y_TOL:
            groups[-1].append(s)
        else:
            groups.append([s])

    bold_lines = []
    for group in groups:
        if all(_BOLD_MARKER in sp.font.lower() for sp in group):
            text = "".join(sp.text for sp in group).strip()
            if text:
                bold_lines.append({
                    "text": text,
                    "page": group[0].page,
                })
    return bold_lines


def _find_heading_page(entry, bold_lines: list[dict]) -> int | None:
    """Ищет заголовок из TOC в жирных строках документа; возвращает страницу или None."""
    query = f"{entry.number} {entry.title}".strip().lower()
    query_words = set(query.split())

    best_score = 0.0
    best_page = None

    for line in bold_lines:
        line_words = set(line["text"].lower().split())
        if not line_words:
            continue
        intersection = query_words & line_words
        score = len(intersection) / max(len(query_words), len(line_words))
        if score > best_score:
            best_score = score
            best_page = line["page"]

    if best_score >= _TITLE_MATCH_THRESHOLD:
        return best_page
    return None


# ── вспомогательные функции ───────────────────────────────────────────────────

def _err(page: int, bbox: tuple, preview: str, expected: str, actual: str) -> ValidationError:
    return ValidationError(
        type=ErrorType.TOC_ERROR,
        page=page,
        bbox=bbox,
        severity=Severity.ERROR,
        text_preview=preview,
        expected=expected,
        actual=actual,
    )


def _warn(page: int, bbox: tuple, preview: str, expected: str, actual: str) -> ValidationError:
    return ValidationError(
        type=ErrorType.TOC_ERROR,
        page=page,
        bbox=bbox,
        severity=Severity.WARNING,
        text_preview=preview,
        expected=expected,
        actual=actual,
    )
