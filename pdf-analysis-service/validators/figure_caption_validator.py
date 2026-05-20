import re

from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, Severity, TextSpan, ValidationError

# Обнаруживает любую строку, начинающуюся с «рисунок» (регистронезависимо)
_DETECT_RE = re.compile(r"^рисунок\b", re.IGNORECASE)

# Эталонный формат: «Рисунок N — Наименование»
# Принимает em-dash (—), en-dash (–) и дефис (-) чтобы дать точечную ошибку на неверный знак
_VALID_RE = re.compile(r"^(Рисунок)\s+(\d+)\s*([—–\-])\s*(.+)$")

_LINE_Y_TOL = 3.0    # pt — спаны в пределах этого Δy считаются одной строкой
_CENTER_TOL = 70.0   # pt — допуск горизонтального центрирования


class FigureCaptionValidator(BaseValidator):
    """
    ГОСТ: подпись рисунка — «Рисунок N — Наименование», арабские цифры,
    сквозная нумерация, по центру под иллюстрацией, без точки в конце.
    """

    @property
    def name(self) -> str:
        return "FigureCaptionValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        errors: list[ValidationError] = []
        lines = _group_into_lines(document.spans)
        caption_lines = [ln for ln in lines if _DETECT_RE.match(ln["text"])]

        expected_num = 1
        for ln in caption_lines:
            page: int = ln["page"]
            text: str = ln["text"]
            bbox: tuple = ln["bbox"]
            x0, _, x1, _ = bbox
            preview = text[:80]

            m = _VALID_RE.match(text)
            if not m:
                errors.append(ValidationError(
                    type=ErrorType.FIGURE_CAPTION_ERROR,
                    page=page,
                    bbox=bbox,
                    severity=Severity.ERROR,
                    text_preview=preview,
                    expected="формат «Рисунок N — Наименование»",
                    actual="формат не распознан",
                ))
                expected_num += 1
                continue

            num = int(m.group(2))
            dash = m.group(3)
            caption_text = m.group(4).strip()

            # Сквозная нумерация
            if num != expected_num:
                errors.append(ValidationError(
                    type=ErrorType.FIGURE_CAPTION_ERROR,
                    page=page,
                    bbox=bbox,
                    severity=Severity.ERROR,
                    text_preview=preview,
                    expected=f"Рисунок {expected_num} (сквозная нумерация)",
                    actual=f"Рисунок {num}",
                ))
            expected_num = num + 1

            # Тире: «—» — эталон; «–» и «-» — предупреждение (допустимо, но не по ГОСТ)
            if dash in ("-", "–"):
                errors.append(ValidationError(
                    type=ErrorType.FIGURE_CAPTION_ERROR,
                    page=page,
                    bbox=bbox,
                    severity=Severity.WARNING,
                    text_preview=preview,
                    expected="длинное тире «—»",
                    actual=f"«{dash}»",
                ))

            # Без точки в конце
            if caption_text.endswith("."):
                errors.append(ValidationError(
                    type=ErrorType.FIGURE_CAPTION_ERROR,
                    page=page,
                    bbox=bbox,
                    severity=Severity.ERROR,
                    text_preview=preview,
                    expected="подпись без точки в конце",
                    actual="точка в конце подписи",
                ))

            # Центрирование
            page_size = document.page_sizes.get(page)
            if page_size:
                page_cx = page_size[0] / 2
                line_cx = (x0 + x1) / 2
                if abs(line_cx - page_cx) > _CENTER_TOL:
                    errors.append(ValidationError(
                        type=ErrorType.FIGURE_CAPTION_ERROR,
                        page=page,
                        bbox=bbox,
                        severity=Severity.ERROR,
                        text_preview=preview,
                        expected="выравнивание по центру страницы",
                        actual=f"отклонение от центра {abs(line_cx - page_cx):.1f} pt (допуск {_CENTER_TOL:.0f} pt)",
                    ))

        return errors


def _group_into_lines(spans: list[TextSpan]) -> list[dict]:
    """Группирует спаны в визуальные строки по признаку (page, близость y-центра)."""
    if not spans:
        return []

    sorted_spans = sorted(
        spans,
        key=lambda s: (s.page, (s.bbox[1] + s.bbox[3]) / 2, s.bbox[0]),
    )

    groups: list[list[TextSpan]] = []
    current: list[TextSpan] = [sorted_spans[0]]

    for span in sorted_spans[1:]:
        last_cy = (current[-1].bbox[1] + current[-1].bbox[3]) / 2
        this_cy = (span.bbox[1] + span.bbox[3]) / 2
        same_page = span.page == current[-1].page
        if same_page and abs(this_cy - last_cy) <= _LINE_Y_TOL:
            current.append(span)
        else:
            groups.append(current)
            current = [span]
    groups.append(current)

    result = []
    for group in groups:
        x0 = min(s.bbox[0] for s in group)
        y0 = min(s.bbox[1] for s in group)
        x1 = max(s.bbox[2] for s in group)
        y1 = max(s.bbox[3] for s in group)
        text = "".join(s.text for s in group).strip()
        if text:
            result.append({"page": group[0].page, "bbox": (x0, y0, x1, y1), "text": text})

    return result
