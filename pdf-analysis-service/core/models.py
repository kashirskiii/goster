from dataclasses import dataclass, field
from enum import Enum


class Severity(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"

    def __str__(self) -> str:
        return self.value


class ErrorType(str, Enum):
    FONT_VALIDATION_ERROR = "FONT_VALIDATION_ERROR"
    PAGE_NUMBER_ERROR = "PAGE_NUMBER_ERROR"
    FIGURE_CAPTION_ERROR = "FIGURE_CAPTION_ERROR"
    TOC_ERROR = "TOC_ERROR"
    STRUCTURAL_HEADING_ERROR = "STRUCTURAL_HEADING_ERROR"
    MARGIN_ERROR = "MARGIN_ERROR"
    LIST_ERROR = "LIST_ERROR"

    def __str__(self) -> str:
        return self.value


@dataclass
class FontRule:
    name: str
    size: float
    color: tuple[int, int, int]

    def __str__(self) -> str:
        return f"{self.name} {self.size}pt {self.color}"


@dataclass
class ValidationError:
    """
    Структурированная ошибка валидации.

    Три ключевые сущности — фрагмент текста, ожидание, факт.
    Конкретный валидатор может оставить любую из них пустой,
    если она не имеет смысла (например, для "номер страницы не найден"
    у нас нет фрагмента текста).
    """
    type: ErrorType
    page: int
    bbox: tuple[float, float, float, float]
    severity: Severity = Severity.ERROR
    text_preview: str = ""    # Фрагмент текста, в котором найдено несоответствие
    expected: str = ""        # Что ожидалось (рекомендация в конкретике)
    actual: str = ""          # Что найдено по факту

    def __str__(self) -> str:
        # Для CLI и логов; HTTP-ответ строится отдельно в api.py.
        head = f"[{self.severity}/{self.type}] [страница {self.page}]"
        preview = f' «{self.text_preview[:60]}»' if self.text_preview else ""
        body: list[str] = []
        if self.expected:
            body.append(f"ожидалось: {self.expected}")
        if self.actual:
            body.append(f"найдено: {self.actual}")
        suffix = "; ".join(body)
        return f"{head}{preview}: {suffix}" if suffix else f"{head}{preview}"


@dataclass
class TextSpan:
    text: str
    font: str
    size: float
    color: int  # packed RGB int from PyMuPDF
    bbox: tuple[float, float, float, float]
    page: int

    @property
    def color_rgb(self) -> tuple[int, int, int]:
        r = (self.color >> 16) & 0xFF
        g = (self.color >> 8) & 0xFF
        b = self.color & 0xFF
        return (r, g, b)


@dataclass
class TocEntry:
    title: str                              # «Введение» / «1.1 Обзор методов»
    number: str                             # «1.1» или «» для ненумерованных разделов
    page: int                               # номер страницы из оглавления
    level: int                              # 0 = верхний, 1 = подраздел, 2 = пункт
    bbox: tuple[float, float, float, float]


@dataclass
class TableOfContents:
    toc_start_page: int
    entries: list[TocEntry] = field(default_factory=list)


@dataclass
class ParsedDocument:
    path: str
    spans: list[TextSpan] = field(default_factory=list)
    page_count: int = 0
    page_sizes: dict[int, tuple[float, float]] = field(default_factory=dict)  # page_num → (width, height)
    toc: TableOfContents | None = None
