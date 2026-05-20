"""
Валидатор заголовков структурных элементов отчёта по ГОСТ:
  СОДЕРЖАНИЕ, ВВЕДЕНИЕ, ЗАКЛЮЧЕНИЕ, СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ,
  ПРИЛОЖЕНИЕ, РЕФЕРАТ, АННОТАЦИЯ

Требования:
  - ПРОПИСНЫМИ буквами
  - Полужирный шрифт (Bold)
  - По центру строки
  - Без точки в конце
  - Начинается с новой страницы (нет текста выше на той же странице)
"""

import re

from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, Severity, TextSpan, ValidationError

# Точные названия (uppercase, после нормализации пробелов)
_EXACT: set[str] = {
    "СОДЕРЖАНИЕ",
    "ВВЕДЕНИЕ",
    "ЗАКЛЮЧЕНИЕ",
    "РЕФЕРАТ",
    "АННОТАЦИЯ",
}

# Префиксы для элементов с возможным продолжением
_PREFIXES: tuple[str, ...] = (
    "СПИСОК",       # СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ и варианты
    "ПРИЛОЖЕНИЕ",  # ПРИЛОЖЕНИЕ А, ПРИЛОЖЕНИЕ Б, ...
)

_CENTER_TOL  = 70.0   # pt — допуск центрирования
_LINE_Y_TOL  = 3.0    # pt — слова на расстоянии ≤ этого — одна строка
_BOTTOM_RATIO = 0.88  # нижняя граница колонтитула (где живут номера страниц)


_LEADER_RE = re.compile(r"\.{3,}")  # три и более точки подряд — лидерная линия TOC


def _is_structural(text: str) -> bool:
    """
    Проверяет, является ли текст кандидатом на структурный заголовок.
    Требует: первая буква заглавная (исключает body-текст с маленькой буквы)
    и строка не содержит лидерных точек (исключает TOC-записи).
    """
    t = re.sub(r"\s+", " ", text).strip()
    if not t or not t[0].isupper():
        return False
    if _LEADER_RE.search(t):
        return False
    tu = t.upper()
    return tu in _EXACT or any(tu.startswith(p) for p in _PREFIXES)


class StructuralHeadingValidator(BaseValidator):
    """
    Проверяет оформление заголовков структурных элементов отчёта.
    """

    @property
    def name(self) -> str:
        return "StructuralHeadingValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        errors: list[ValidationError] = []

        # Сгруппировать спаны в визуальные строки
        lines = _group_into_lines(document.spans)

        # Индекс спанов по страницам для проверки «с новой страницы»
        spans_by_page: dict[int, list[TextSpan]] = {}
        for span in document.spans:
            spans_by_page.setdefault(span.page, []).append(span)

        for line_spans in lines:
            raw_text = "".join(s.text for s in line_spans).strip()
            text = re.sub(r"\s+", " ", raw_text)

            if not _is_structural(text):
                continue

            page = line_spans[0].page
            bbox = (
                min(s.bbox[0] for s in line_spans),
                min(s.bbox[1] for s in line_spans),
                max(s.bbox[2] for s in line_spans),
                max(s.bbox[3] for s in line_spans),
            )
            page_size  = document.page_sizes.get(page, (595.0, 842.0))
            page_w, page_h = page_size
            heading_cy = (bbox[1] + bbox[3]) / 2

            # 1. Прописные буквы
            if text != text.upper():
                errors.append(_err(page, bbox, text,
                    expected="ПРОПИСНЫЕ буквы во всём заголовке",
                    actual="присутствуют строчные буквы"))

            # 2. Полужирный шрифт
            non_bold = [s for s in line_spans if "bold" not in s.font.lower()]
            if non_bold:
                sample = ", ".join(f"«{s.font}»" for s in non_bold[:2])
                errors.append(_err(page, bbox, text,
                    expected="полужирный шрифт",
                    actual=f"шрифт без bold: {sample}"))

            # 3. По центру строки
            line_cx = (bbox[0] + bbox[2]) / 2
            if abs(line_cx - page_w / 2) > _CENTER_TOL:
                errors.append(_err(page, bbox, text,
                    expected="выравнивание по центру страницы",
                    actual=f"отклонение от центра {abs(line_cx - page_w / 2):.1f} pt (допуск {_CENTER_TOL:.0f} pt)"))

            # 4. Без точки в конце
            if text.rstrip().endswith("."):
                errors.append(_err(page, bbox, text,
                    expected="без точки в конце",
                    actual="точка в конце заголовка"))

            # 5. Начинается с новой страницы
            #    — на той же странице не должно быть текста выше заголовка
            #      (кроме нижнего колонтитула с номером страницы)
            bottom_y = page_h * _BOTTOM_RATIO
            above = [
                s for s in spans_by_page.get(page, [])
                if (s.bbox[1] + s.bbox[3]) / 2 < heading_cy - _LINE_Y_TOL
                and s.bbox[3] < bottom_y
            ]
            if above:
                errors.append(_err(page, bbox, text,
                    expected="заголовок начинается с новой страницы",
                    actual=f"на странице {page} есть текст выше заголовка"))

        return errors


# ── вспомогательные функции ───────────────────────────────────────────────────

def _group_into_lines(spans: list[TextSpan]) -> list[list[TextSpan]]:
    """Группирует спаны в визуальные строки по (page, Y-близость)."""
    if not spans:
        return []
    sorted_spans = sorted(
        spans,
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
    for g in groups:
        g.sort(key=lambda s: s.bbox[0])
    return groups


def _err(page: int, bbox: tuple, text: str, expected: str, actual: str) -> ValidationError:
    preview = text[:80]
    return ValidationError(
        type=ErrorType.STRUCTURAL_HEADING_ERROR,
        page=page,
        bbox=bbox,
        severity=Severity.ERROR,
        text_preview=preview,
        expected=expected,
        actual=actual,
    )
