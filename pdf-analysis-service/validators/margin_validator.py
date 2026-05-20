import re

from config.settings import MarginRule
from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, TextSpan, ValidationError

# 1 миллиметр = 72/25.4 пункта PostScript
MM_TO_PT = 72.0 / 25.4

# Шаблон номера страницы: короткое число с опциональной точкой ("12", "12.").
_PAGE_NUMBER_RE = re.compile(r"^\d{1,4}\.?$")
# Доля высоты страницы, в пределах которой короткое число считаем номером
# страницы (верх/низ) и не учитываем при проверке полей.
_HEADER_FOOTER_RATIO = 0.15


class MarginValidator(BaseValidator):
    """
    ГОСТ 7.32-2017: левое поле 30 мм, правое 15 мм, верх/низ 20 мм.

    Строим прямоугольник body по значениям из конфига и проверяем, что в
    запретной зоне (за рамкой) нет текста. Допуск `tolerance_mm` расширяет
    рамку на каждую сторону. Номер страницы и пустые спаны игнорируются.

    Одна ошибка на страницу: суммируем все четыре стороны в одно сообщение.
    """

    def __init__(self, rule: MarginRule) -> None:
        self._rule = rule

    @property
    def name(self) -> str:
        return "MarginValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        errors: list[ValidationError] = []
        for page_num in range(1, document.page_count + 1):
            page_size = document.page_sizes.get(page_num)
            if not page_size:
                continue
            page_width, page_height = page_size
            err = self._check_page(document, page_num, page_width, page_height)
            if err:
                errors.append(err)
        return errors

    def _check_page(
        self,
        document: ParsedDocument,
        page_num: int,
        page_width: float,
        page_height: float,
    ) -> ValidationError | None:
        rule = self._rule
        tol_pt = rule.tolerance_mm * MM_TO_PT

        # Рамка body из конфига (без учёта допуска).
        body_left = rule.left_mm * MM_TO_PT
        body_right = page_width - rule.right_mm * MM_TO_PT
        body_top = rule.top_mm * MM_TO_PT
        body_bottom = page_height - rule.bottom_mm * MM_TO_PT

        # Границы с допуском — вылет за них считается нарушением.
        allow_left = body_left - tol_pt
        allow_right = body_right + tol_pt
        allow_top = body_top - tol_pt
        allow_bottom = body_bottom + tol_pt

        header_zone = page_height * _HEADER_FOOTER_RATIO
        footer_zone = page_height * (1.0 - _HEADER_FOOTER_RATIO)

        # Ищем самый дальний вылет за рамку с каждой стороны.
        worst: dict[str, float] = {}
        offenders: list[TextSpan] = []
        for span in document.spans:
            if span.page != page_num:
                continue
            text = span.text.strip()
            if not text:
                continue
            # Номер страницы — короткое число в верхней/нижней зоне.
            if _PAGE_NUMBER_RE.match(text):
                cy = (span.bbox[1] + span.bbox[3]) / 2
                if cy <= header_zone or cy >= footer_zone:
                    continue

            x0, y0, x1, y1 = span.bbox
            is_offender = False
            if x0 < allow_left:
                worst["left"] = min(worst.get("left", x0), x0)
                is_offender = True
            if x1 > allow_right:
                worst["right"] = max(worst.get("right", x1), x1)
                is_offender = True
            if y0 < allow_top:
                worst["top"] = min(worst.get("top", y0), y0)
                is_offender = True
            if y1 > allow_bottom:
                worst["bottom"] = max(worst.get("bottom", y1), y1)
                is_offender = True
            if is_offender:
                offenders.append(span)

        if not offenders:
            return None

        violations: list[str] = []
        if "left" in worst:
            actual_mm = worst["left"] / MM_TO_PT
            violations.append(
                f"левое: {actual_mm:.1f} мм (ожид. {rule.left_mm:.0f} мм)"
            )
        if "right" in worst:
            actual_mm = (page_width - worst["right"]) / MM_TO_PT
            violations.append(
                f"правое: {actual_mm:.1f} мм (ожид. {rule.right_mm:.0f} мм)"
            )
        if "top" in worst:
            actual_mm = worst["top"] / MM_TO_PT
            violations.append(
                f"верхнее: {actual_mm:.1f} мм (ожид. {rule.top_mm:.0f} мм)"
            )
        if "bottom" in worst:
            actual_mm = (page_height - worst["bottom"]) / MM_TO_PT
            violations.append(
                f"нижнее: {actual_mm:.1f} мм (ожид. {rule.bottom_mm:.0f} мм)"
            )

        expected_str = (
            f"Поля по ГОСТ: левое {rule.left_mm:.0f} мм, правое {rule.right_mm:.0f} мм, "
            f"верх {rule.top_mm:.0f} мм, низ {rule.bottom_mm:.0f} мм "
            f"(допуск ±{rule.tolerance_mm:.0f} мм)"
        )
        actual_str = "; ".join(violations)

        # bbox — объединяющий прямоугольник нарушающих спанов, чтобы UI подсветил вылет.
        x0 = min(s.bbox[0] for s in offenders)
        x1 = max(s.bbox[2] for s in offenders)
        y0 = min(s.bbox[1] for s in offenders)
        y1 = max(s.bbox[3] for s in offenders)
        return ValidationError(
            type=ErrorType.MARGIN_ERROR,
            page=page_num,
            bbox=(x0, y0, x1, y1),
            text_preview="",
            expected=expected_str,
            actual=actual_str,
        )
