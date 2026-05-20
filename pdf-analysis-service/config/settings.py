import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AllowedFont:
    name: str
    size: float
    color: tuple[int, int, int]
    size_tolerance: float = 0.0
    color_tolerance: int = 0  # максимальное отклонение по каждому каналу RGB
    description: str = ""  # человекочитаемое описание правила для сообщения об ошибке

    @property
    def color_packed(self) -> int:
        r, g, b = self.color
        return (r << 16) | (g << 8) | b


@dataclass
class ValidatorFlags:
    """
    Включение/выключение каждого валидатора. Значение по умолчанию — True
    (валидатор работает), что сохраняет обратную совместимость со старыми
    конфигами без ключа `validators`.

    FontValidator не входит в этот список — он отключается через пустой
    `allowed_fonts`.
    """
    page_number: bool = True
    figure_caption: bool = True
    toc: bool = True
    structural_heading: bool = True
    margin: bool = True
    list: bool = True

    @classmethod
    def from_dict(cls, data: dict | None) -> "ValidatorFlags":
        if not data:
            return cls()
        return cls(
            page_number=bool(data.get("page_number", True)),
            figure_caption=bool(data.get("figure_caption", True)),
            toc=bool(data.get("toc", True)),
            structural_heading=bool(data.get("structural_heading", True)),
            margin=bool(data.get("margin", True)),
            list=bool(data.get("list", True)),
        )


@dataclass
class MarginRule:
    """
    Поля страницы по ГОСТ 7.32-2017 (мм): левое 30, правое 15, верх/низ 20.
    `tolerance_mm` — допуск на каждую сторону в обе стороны.
    `ignore_top_band_mm` / `ignore_bottom_band_mm` — полосы у верхней/нижней
    границы страницы, в которых игнорируем содержимое (там обычно номер
    страницы / колонтитул, не относящиеся к телу документа).
    """
    left_mm: float = 30.0
    right_mm: float = 15.0
    top_mm: float = 20.0
    bottom_mm: float = 20.0
    tolerance_mm: float = 2.5
    ignore_top_band_mm: float = 15.0
    ignore_bottom_band_mm: float = 15.0

    @classmethod
    def from_dict(cls, data: dict | None) -> "MarginRule":
        if not data:
            return cls()
        return cls(
            left_mm=float(data.get("left_mm", 30.0)),
            right_mm=float(data.get("right_mm", 15.0)),
            top_mm=float(data.get("top_mm", 20.0)),
            bottom_mm=float(data.get("bottom_mm", 20.0)),
            tolerance_mm=float(data.get("tolerance_mm", 2.5)),
            ignore_top_band_mm=float(data.get("ignore_top_band_mm", 15.0)),
            ignore_bottom_band_mm=float(data.get("ignore_bottom_band_mm", 15.0)),
        )


@dataclass
class Config:
    allowed_fonts: list[AllowedFont]
    ignore_fonts: list[str] = field(default_factory=list)
    validators: ValidatorFlags = field(default_factory=ValidatorFlags)
    margins: MarginRule = field(default_factory=MarginRule)

    @classmethod
    def from_dict(cls, data: dict) -> "Config":
        return cls(
            allowed_fonts=[
                AllowedFont(
                    name=f["name"],
                    size=float(f["size"]),
                    color=tuple(f["color"]),
                    size_tolerance=float(f.get("size_tolerance", 0.0)),
                    color_tolerance=int(f.get("color_tolerance", 0)),
                    description=f.get("description", ""),
                )
                for f in data.get("allowed_fonts", [])
            ],
            ignore_fonts=data.get("ignore_fonts", []),
            validators=ValidatorFlags.from_dict(data.get("validators")),
            margins=MarginRule.from_dict(data.get("margins")),
        )

    @classmethod
    def from_json(cls, path: str | Path) -> "Config":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    @classmethod
    def default(cls) -> "Config":
        return cls(
            allowed_fonts=[
                AllowedFont(name="TimesNewRomanPSMT", size=14.0, color=(0, 0, 0)),
            ],
            ignore_fonts=["SymbolMT"],
        )
