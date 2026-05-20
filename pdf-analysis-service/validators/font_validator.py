from config.settings import AllowedFont, Config
from core.interfaces import BaseValidator
from core.models import ErrorType, ParsedDocument, TextSpan, ValidationError


class FontValidator(BaseValidator):
    def __init__(self, config: Config) -> None:
        self._allowed = config.allowed_fonts
        self._ignore = {f.lower() for f in config.ignore_fonts}

    @property
    def name(self) -> str:
        return "FontValidator"

    def validate(self, document: ParsedDocument) -> list[ValidationError]:
        # Пустой allowed_fonts = валидатор шрифтов отключён (пресет "без проверки шрифта").
        if not self._allowed:
            return []
        errors: list[ValidationError] = []
        for span in document.spans:
            if span.font.lower() in self._ignore:
                continue
            if not self._matches_any(span):
                errors.append(self._make_error(span))
        return errors

    def _matches_any(self, span: TextSpan) -> bool:
        return any(self._matches_rule(span, rule) for rule in self._allowed)

    def _matches_rule(self, span: TextSpan, rule: AllowedFont) -> bool:
        font_ok = span.font.lower() == rule.name.lower()
        size_ok = abs(span.size - rule.size) <= rule.size_tolerance
        color_ok = self._color_matches(span.color_rgb, rule.color, rule.color_tolerance)
        return font_ok and size_ok and color_ok

    @staticmethod
    def _color_matches(
        actual: tuple[int, int, int],
        expected: tuple[int, int, int],
        tolerance: int,
    ) -> bool:
        return all(abs(a - e) <= tolerance for a, e in zip(actual, expected))

    @staticmethod
    def _format_rule(rule: AllowedFont) -> str:
        if rule.description:
            return rule.description
        return f"{rule.name} {rule.size}pt {rule.color}"

    def _make_error(self, span: TextSpan) -> ValidationError:
        r, g, b = span.color_rgb
        expected = "\n".join(self._format_rule(rule) for rule in self._allowed)
        return ValidationError(
            type=ErrorType.FONT_VALIDATION_ERROR,
            page=span.page,
            bbox=span.bbox,
            text_preview=span.text,
            expected=expected,
            actual=f"{span.font} {span.size}pt ({r}, {g}, {b})",
        )
