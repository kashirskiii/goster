import re

from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, TextSpan, ValidationError


class PageNumberValidator(BaseValidator):
    """
    ГОСТ: страницы нумеруются арабскими цифрами сквозной нумерацией.
    Номер — в центре нижней части страницы, без точки.
    Титульный лист (стр. 1) не нумеруется; лист с содержанием — стр. 2.
    """

    # Центр по Y спана должен быть ниже этой доли высоты страницы.
    BOTTOM_RATIO: float = 0.88
    # Допустимое отклонение центра спана от центра страницы по X, пт.
    CENTER_TOLERANCE: float = 70.0

    @property
    def name(self) -> str:
        return "PageNumberValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        errors: list[ValidationError] = []
        for page_num in range(1, document.page_count + 1):
            page_size = document.page_sizes.get(page_num)
            if not page_size:
                continue
            page_width, page_height = page_size
            bottom_spans = self._bottom_center_spans(
                document, page_num, page_width, page_height
            )
            if page_num == 1:
                errors.extend(self._check_title_page(page_num, bottom_spans))
            else:
                errors.extend(self._check_numbered_page(page_num, bottom_spans))
        return errors

    def _bottom_center_spans(
        self,
        document: ParsedDocument,
        page_num: int,
        page_width: float,
        page_height: float,
    ) -> list[TextSpan]:
        result = []
        for span in document.spans:
            if span.page != page_num:
                continue
            cy = (span.bbox[1] + span.bbox[3]) / 2
            cx = (span.bbox[0] + span.bbox[2]) / 2
            in_bottom = cy >= page_height * self.BOTTOM_RATIO
            in_center = abs(cx - page_width / 2) <= self.CENTER_TOLERANCE
            if in_bottom and in_center:
                result.append(span)
        return result

    def _check_title_page(
        self, page_num: int, spans: list[TextSpan]
    ) -> list[ValidationError]:
        numeric = [s for s in spans if re.fullmatch(r"\d+\.?", s.text.strip())]
        if not numeric:
            return []
        s = numeric[0]
        return [ValidationError(
            type=ErrorType.PAGE_NUMBER_ERROR,
            page=page_num,
            bbox=s.bbox,
            text_preview=s.text.strip(),
            expected="номер не проставляется на титульном листе",
            actual=f"«{s.text.strip()}»",
        )]

    def _check_numbered_page(
        self, page_num: int, spans: list[TextSpan]
    ) -> list[ValidationError]:
        expected = str(page_num)
        texts = [s.text.strip() for s in spans]

        if expected in texts:
            return []

        # Номер есть, но с точкой
        with_dot = expected + "."
        if with_dot in texts:
            s = spans[texts.index(with_dot)]
            return [ValidationError(
                type=ErrorType.PAGE_NUMBER_ERROR,
                page=page_num,
                bbox=s.bbox,
                text_preview=s.text.strip(),
                expected=f"«{expected}» без точки",
                actual=f"«{s.text.strip()}»",
            )]

        # Есть какое-то число, но не то
        numeric = [(t, s) for t, s in zip(texts, spans) if re.fullmatch(r"\d+\.?", t)]
        if numeric:
            t, s = numeric[0]
            return [ValidationError(
                type=ErrorType.PAGE_NUMBER_ERROR,
                page=page_num,
                bbox=s.bbox,
                text_preview=t,
                expected=f"«{expected}»",
                actual=f"«{t}»",
            )]

        # Номер отсутствует
        return [ValidationError(
            type=ErrorType.PAGE_NUMBER_ERROR,
            page=page_num,
            bbox=(0.0, 0.0, 0.0, 0.0),
            text_preview="",
            expected=f"номер «{expected}» в центре нижней части страницы",
            actual="номер отсутствует",
        )]
