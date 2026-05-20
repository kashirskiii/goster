"""
Извлечение структуры СОДЕРЖАНИЯ из PDF-документа.

Алгоритм:
1. Найти страницу с заголовком «СОДЕРЖАНИЕ» / «ОГЛАВЛЕНИЕ» по центру.
2. Собрать слова через page.get_text("words"), исключая нижний колонтитул.
3. Сгруппировать слова в визуальные строки по (page, Y-близость).
4. Объединить строки-продолжения (без лидера и номера) со следующей строкой.
5. В каждой строке: слово из точек — разделитель-лидер, последнее цифровое
   слово справа — номер страницы, остальное — заголовок.
6. Определить уровень иерархии по x-позиции первого слова строки.
"""

import re
from dataclasses import dataclass

import fitz  # PyMuPDF

from core.models import TableOfContents, TocEntry

_TOC_HEADER_RE  = re.compile(r"^(содержание|оглавление)$", re.IGNORECASE)
_DOTS_RE        = re.compile(r"^\.+$")
_PAGE_NUM_RE    = re.compile(r"^\d+$")
_SECTION_NUM_RE = re.compile(r"^(\d+(?:\.\d+)*)\s+")

_LINE_Y_TOL   = 3.0   # pt — слова ближе этого порога по Y — одна строка
_LEVEL_X_STEP = 8.0   # pt — шаг по X для следующего уровня иерархии
_BOTTOM_RATIO = 0.88  # строки ниже этой доли высоты — колонтитул, игнорировать


@dataclass
class _Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    page: int  # номер страницы (1-based) — нужен для корректной сортировки


def extract_toc(
    doc: fitz.Document,
    page_sizes: dict[int, tuple[float, float]],
) -> TableOfContents | None:
    toc_start_page = _find_toc_page(doc, page_sizes)
    if toc_start_page is None:
        return None

    words = _collect_toc_words(doc, toc_start_page, page_sizes)
    lines = _group_into_lines(words)

    # Убрать строку-заголовок («СОДЕРЖАНИЕ»)
    lines = [ln for ln in lines if not _TOC_HEADER_RE.match(_line_text(ln))]

    # Объединить строки-продолжения с их завершающей строкой
    lines = _merge_continuation_lines(lines)

    if not lines:
        return TableOfContents(toc_start_page=toc_start_page)

    # Базовый x для уровня 0 — минимальный x0 среди первых слов всех строк
    base_x = min(ln[0].x0 for ln in lines if ln)

    entries: list[TocEntry] = []
    for line in lines:
        entry = _parse_line(line, base_x)
        if entry is not None:
            entries.append(entry)

    return TableOfContents(toc_start_page=toc_start_page, entries=entries)


# ── поиск страницы TOC ────────────────────────────────────────────────────────

def _find_toc_page(
    doc: fitz.Document,
    page_sizes: dict[int, tuple[float, float]],
) -> int | None:
    for pg_idx in range(min(10, doc.page_count)):
        page_num = pg_idx + 1
        page_width = page_sizes.get(page_num, (595.0, 842.0))[0]
        page_cx = page_width / 2
        page = doc[pg_idx]

        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if _TOC_HEADER_RE.match(text):
                        span_cx = (span["bbox"][0] + span["bbox"][2]) / 2
                        if abs(span_cx - page_cx) < 100:
                            return page_num
    return None


# ── сбор слов со страниц TOC ─────────────────────────────────────────────────

def _collect_toc_words(
    doc: fitz.Document,
    start_page: int,
    page_sizes: dict[int, tuple[float, float]],
) -> list[_Word]:
    all_words: list[_Word] = []
    for pg_idx in range(start_page - 1, min(start_page + 3, doc.page_count)):
        page_num = pg_idx + 1
        page_height = page_sizes.get(page_num, (595.0, 842.0))[1]
        bottom_y = page_height * _BOTTOM_RATIO

        page = doc[pg_idx]
        page_words = [
            _Word(text=w[4], x0=w[0], y0=w[1], x1=w[2], y1=w[3], page=page_num)
            for w in page.get_text("words")
            if w[4].strip() and w[1] < bottom_y
        ]

        if pg_idx > start_page - 1:
            # Продолжаем TOC только пока видим лидерные линии
            if not any(_DOTS_RE.match(w.text) for w in page_words):
                break

        all_words.extend(page_words)
    return all_words


# ── группировка слов в строки ─────────────────────────────────────────────────

def _group_into_lines(words: list[_Word]) -> list[list[_Word]]:
    """Группирует слова в визуальные строки; слова с разных страниц не смешиваются."""
    if not words:
        return []

    # Сортируем по (page, y-центр, x) — y-координаты page-local, поэтому страница идёт первой
    sorted_words = sorted(
        words,
        key=lambda w: (w.page, (w.y0 + w.y1) / 2, w.x0),
    )

    groups: list[list[_Word]] = [[sorted_words[0]]]
    for w in sorted_words[1:]:
        last = groups[-1][-1]
        last_cy = (last.y0 + last.y1) / 2
        this_cy = (w.y0 + w.y1) / 2
        same_page = w.page == last.page
        if same_page and abs(this_cy - last_cy) <= _LINE_Y_TOL:
            groups[-1].append(w)
        else:
            groups.append([w])

    for g in groups:
        g.sort(key=lambda w: w.x0)
    return groups


def _line_text(line: list[_Word]) -> str:
    return " ".join(w.text for w in line).strip()


# ── объединение строк-продолжений ─────────────────────────────────────────────

def _has_leader(line: list[_Word]) -> bool:
    return any(_DOTS_RE.match(w.text) for w in line)


def _ends_with_page(line: list[_Word]) -> bool:
    return bool(line) and bool(_PAGE_NUM_RE.match(line[-1].text))


def _is_complete(line: list[_Word]) -> bool:
    """Строка полная, если есть лидер (точки) ИЛИ оканчивается числом страницы."""
    return _has_leader(line) or _ends_with_page(line)


def _merge_continuation_lines(lines: list[list[_Word]]) -> list[list[_Word]]:
    """
    Если строка не имеет лидера и не заканчивается числом (= начало многострочной
    записи), объединяет её со следующей строкой, которая запись завершает.
    """
    result: list[list[_Word]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not _is_complete(line) and i + 1 < len(lines):
            next_line = lines[i + 1]
            if _is_complete(next_line):
                result.append(line + next_line)
                i += 2
                continue
        result.append(line)
        i += 1
    return result


# ── разбор строки в TocEntry ──────────────────────────────────────────────────

def _parse_line(line: list[_Word], base_x: float) -> TocEntry | None:
    if not line:
        return None

    leader_idx = next(
        (i for i, w in enumerate(line) if _DOTS_RE.match(w.text)), None
    )

    page_num: int | None = None
    title_words: list[_Word]

    if leader_idx is not None:
        title_words = line[:leader_idx]
        digit_words = [w for w in line[leader_idx + 1:] if _PAGE_NUM_RE.match(w.text)]
        if digit_words:
            page_num = int(digit_words[-1].text)
    else:
        if _ends_with_page(line):
            page_num = int(line[-1].text)
            title_words = line[:-1]
        else:
            title_words = line

    if not title_words or page_num is None:
        return None

    title_text = " ".join(w.text for w in title_words).strip()
    if not title_text:
        return None

    m = _SECTION_NUM_RE.match(title_text)
    number = m.group(1) if m else ""
    title_clean = title_text[m.end():].strip() if m else title_text

    first_x = title_words[0].x0
    level = max(0, round((first_x - base_x) / _LEVEL_X_STEP))

    x0 = min(w.x0 for w in title_words)
    y0 = min(w.y0 for w in line)
    x1 = max(w.x1 for w in line)
    y1 = max(w.y1 for w in line)

    return TocEntry(
        title=title_clean,
        number=number,
        page=page_num,
        level=level,
        bbox=(x0, y0, x1, y1),
    )
