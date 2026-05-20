import re

from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, TextSpan, ValidationError

# Допустимые тире для маркера: en dash, em dash, обычный дефис, modifier minus,
# математический минус. Реально в работах чаще всего en dash «–» или дефис «-».
DASH_RE = re.compile(r"^([–—˗−\-])\s+")
LETTER_PAREN_RE = re.compile(r"^([А-ЯЁа-яёA-Za-z])\)\s+")
LETTER_DOT_RE = re.compile(r"^([А-ЯЁа-яёA-Za-z])\.\s+")
DIGIT_PAREN_RE = re.compile(r"^(\d+)\)\s+")
DIGIT_DOT_RE = re.compile(r"^(\d+)\.\s+")
BAD_BULLET_RE = re.compile(r"^([\*•·►›▪♦◦●○])\s+")

CYR_LOWER = set("абвгдеёжзийклмнопрстуфхцчшщъыьэюя")

# Допустимое расхождение y-координаты, чтобы спаны попали в одну линию.
LINE_Y_EPS = 2.5
# Допустимое расхождение x0 (отступа), чтобы линии попали в один список.
LIST_X_EPS = 5.0


class ListValidator(BaseValidator):
    """
    ГОСТ 7.32-2017, перечисления:
      - маркер по умолчанию — тире «–»;
      - буквенный пункт: строчная русская буква со скобкой, «а)», «б)», ...;
      - числовой пункт: арабская цифра со скобкой, «1)», «2)», ...;
      - точка вместо скобки, прочие буллеты («*», «•», ...), латиница и
        прописные буквы — нарушение.

    Чтобы не путать список с заголовком вида «1. Введение», валидатор
    рассматривает только серии из ≥2 подряд идущих линий с похожим x0.
    """

    @property
    def name(self) -> str:
        return "ListValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        errors: list[ValidationError] = []
        for page_num in range(1, document.page_count + 1):
            lines = self._lines_for_page(document.spans, page_num)
            for run in self._detect_list_runs(lines):
                errors.extend(self._check_run(run, page_num))
        return errors

    # ── группировка спанов в линии ────────────────────────────────────────

    def _lines_for_page(
        self, spans: list[TextSpan], page_num: int
    ) -> list[list[TextSpan]]:
        page_spans = sorted(
            (s for s in spans if s.page == page_num),
            key=lambda s: (round(s.bbox[1], 1), s.bbox[0]),
        )
        lines: list[list[TextSpan]] = []
        current: list[TextSpan] = []
        anchor_y: float | None = None
        for s in page_spans:
            if anchor_y is None or abs(s.bbox[1] - anchor_y) <= LINE_Y_EPS:
                current.append(s)
                if anchor_y is None:
                    anchor_y = s.bbox[1]
            else:
                lines.append(current)
                current = [s]
                anchor_y = s.bbox[1]
        if current:
            lines.append(current)
        # внутри линии гарантируем left-to-right
        for ln in lines:
            ln.sort(key=lambda s: s.bbox[0])
        return lines

    # ── распознавание маркеров и группировка в списки ─────────────────────

    @staticmethod
    def _classify(line_text: str) -> tuple[str, str] | None:
        """
        Возвращает (kind, marker) или None. Порядок проб важен: dash и
        bad_bullet — однозначные «один символ + пробел», их проверяем первыми.
        """
        if m := DASH_RE.match(line_text):
            return ("dash", m.group(1))
        if m := BAD_BULLET_RE.match(line_text):
            return ("bad_bullet", m.group(1))
        if m := LETTER_PAREN_RE.match(line_text):
            return ("letter_paren", m.group(1))
        if m := DIGIT_PAREN_RE.match(line_text):
            return ("digit_paren", m.group(1))
        if m := LETTER_DOT_RE.match(line_text):
            return ("letter_dot", m.group(1))
        if m := DIGIT_DOT_RE.match(line_text):
            return ("digit_dot", m.group(1))
        return None

    def _detect_list_runs(
        self, lines: list[list[TextSpan]]
    ) -> list[list[tuple[list[TextSpan], str, str]]]:
        """
        Возвращает группы линий, образующих список: ≥2 подряд линий с
        маркером и совпадающим (с допуском) x0. Каждая запись внутри группы —
        (spans, kind, marker).
        """
        annotated: list[tuple[list[TextSpan], str, str] | None] = []
        for ln in lines:
            text = " ".join(s.text for s in ln).strip()
            cls = self._classify(text)
            annotated.append((ln, cls[0], cls[1]) if cls else None)

        runs: list[list[tuple[list[TextSpan], str, str]]] = []
        current: list[tuple[list[TextSpan], str, str]] = []
        anchor_x: float | None = None
        for item in annotated:
            if item is None:
                if len(current) >= 2:
                    runs.append(current)
                current = []
                anchor_x = None
                continue
            x0 = item[0][0].bbox[0]
            if anchor_x is None or abs(x0 - anchor_x) <= LIST_X_EPS:
                current.append(item)
                anchor_x = x0 if anchor_x is None else anchor_x
            else:
                if len(current) >= 2:
                    runs.append(current)
                current = [item]
                anchor_x = x0
        if len(current) >= 2:
            runs.append(current)
        return runs

    # ── проверка ГОСТ-валидности маркеров ─────────────────────────────────

    def _check_run(
        self,
        run: list[tuple[list[TextSpan], str, str]],
        page_num: int,
    ) -> list[ValidationError]:
        errors: list[ValidationError] = []
        for spans, kind, marker in run:
            issue = self._issue_for(kind, marker)
            if not issue:
                continue
            head_span = spans[0]
            preview = " ".join(s.text for s in spans).strip()[:60]
            errors.append(
                ValidationError(
                    type=ErrorType.LIST_ERROR,
                    page=page_num,
                    bbox=head_span.bbox,
                    text_preview=preview,
                    expected=issue[0],
                    actual=issue[1],
                )
            )
        return errors

    @staticmethod
    def _issue_for(kind: str, marker: str) -> tuple[str, str] | None:
        """Возвращает (expected, actual) или None если маркер ГОСТ-валиден."""
        if kind == "dash":
            return None
        if kind == "digit_paren":
            return None
        if kind == "letter_paren":
            if marker in CYR_LOWER:
                return None
            if marker.isupper():
                return (
                    "Перечисления буквами: строчная русская буква со скобкой («а)», «б)», «в)»)",
                    f"«{marker})» — прописная буква",
                )
            # Латиница в нижнем регистре
            return (
                "Перечисления буквами: строчная русская буква со скобкой («а)», «б)», «в)»)",
                f"«{marker})» — латинская буква",
            )
        if kind == "letter_dot":
            return (
                "После буквенного маркера ставится скобка, не точка: «а)», «б)», «в)»",
                f"«{marker}.» — точка вместо скобки",
            )
        if kind == "digit_dot":
            return (
                "После цифрового маркера ставится скобка, не точка: «1)», «2)», «3)»",
                f"«{marker}.» — точка вместо скобки",
            )
        if kind == "bad_bullet":
            return (
                "Маркер перечисления — тире «–»",
                f"«{marker}» — недопустимый символ маркера",
            )
        return None
