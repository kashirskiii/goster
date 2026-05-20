import sys
from pathlib import Path

from config.settings import Config
from services.validation_service import ValidationService
from validators.figure_caption_validator import FigureCaptionValidator
from validators.font_validator import FontValidator
from validators.list_validator import ListValidator
from validators.margin_validator import MarginValidator
from validators.page_number_validator import PageNumberValidator
from validators.structural_heading_validator import StructuralHeadingValidator
from validators.toc_validator import TocValidator


def main() -> None:
    if len(sys.argv) < 2:
        print("Использование: python main.py <path_to.pdf> [config.json]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Файл не найден: {pdf_path}")
        sys.exit(1)

    config_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("gost_config.json")
    config = Config.from_json(config_path) if config_path.exists() else Config.default()

    flags = config.validators
    validators: list = [FontValidator(config)]
    if flags.page_number:
        validators.append(PageNumberValidator())
    if flags.figure_caption:
        validators.append(FigureCaptionValidator())
    if flags.toc:
        validators.append(TocValidator())
    if flags.structural_heading:
        validators.append(StructuralHeadingValidator())
    if flags.margin:
        validators.append(MarginValidator(config.margins))
    if flags.list:
        validators.append(ListValidator())
    service = ValidationService(validators=validators)

    report = service.validate(pdf_path)
    print(report.summary())


if __name__ == "__main__":
    main()
