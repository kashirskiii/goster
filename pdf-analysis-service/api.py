"""
FastAPI приложение для валидации PDF-документов по ГОСТ.

POST /validate        — принимает PDF файл, возвращает структурированный отчёт.
POST /render-snippet  — рендерит PNG-фрагмент страницы с подсветкой bbox.
GET  /health          — проверка работоспособности сервиса.
"""

import json
import tempfile
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from config.settings import Config
from services.validation_service import ValidationReport, ValidationService
from validators.figure_caption_validator import FigureCaptionValidator
from validators.font_validator import FontValidator
from validators.list_validator import ListValidator
from validators.margin_validator import MarginValidator
from validators.page_number_validator import PageNumberValidator
from validators.structural_heading_validator import StructuralHeadingValidator
from validators.toc_validator import TocValidator

app = FastAPI(
    title="PDF GOST Validator",
    description="Валидация PDF-документов по требованиям ГОСТ",
    version="1.0.0",
)

_CONFIG_PATH = Path("gost_config.json")


def _load_default_config() -> Config:
    return Config.from_json(_CONFIG_PATH) if _CONFIG_PATH.exists() else Config.default()


def _build_service(config: Config) -> ValidationService:
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
    return ValidationService(validators=validators)


# ── Pydantic response models ──────────────────────────────────────────────────

class IssueModel(BaseModel):
    severity: str
    type: str
    page: int
    text_preview: str
    expected: str
    actual: str
    message: str  # сводка для логов / обратной совместимости
    bbox: tuple[float, float, float, float]


class CheckResultModel(BaseModel):
    validator: str
    is_valid: bool
    error_count: int
    warning_count: int
    issues: list[IssueModel]


class ValidationResultModel(BaseModel):
    document: str
    page_count: int
    is_valid: bool
    total_errors: int
    total_warnings: int
    checks: list[CheckResultModel]


# ── конвертация внутренних моделей в Pydantic ─────────────────────────────────

def _to_response(report: ValidationReport, filename: str) -> ValidationResultModel:
    checks: list[CheckResultModel] = []
    for check in report.checks:
        issues = [
            IssueModel(
                severity=str(issue.severity),
                type=str(issue.type),
                page=issue.page,
                text_preview=issue.text_preview,
                expected=issue.expected,
                actual=issue.actual,
                message=str(issue),
                bbox=issue.bbox,
            )
            for issue in check.issues
        ]
        checks.append(CheckResultModel(
            validator=check.validator_name,
            is_valid=check.is_valid,
            error_count=len(check.errors),
            warning_count=len(check.warnings),
            issues=issues,
        ))

    total_errors = sum(c.error_count for c in checks)
    total_warnings = sum(c.warning_count for c in checks)

    return ValidationResultModel(
        document=filename,
        page_count=report.page_count,
        is_valid=report.is_valid,
        total_errors=total_errors,
        total_warnings=total_warnings,
        checks=checks,
    )


# ── эндпоинты ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/validate", response_model=ValidationResultModel)
async def validate_pdf(
    file: UploadFile = File(...),
    config: str | None = Form(default=None),
) -> JSONResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Ожидается PDF файл")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Файл пустой")

    if config:
        try:
            cfg = Config.from_dict(json.loads(config))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Невалидный config: {exc}") from exc
    else:
        cfg = _load_default_config()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = Path(tmp.name)

    try:
        service = _build_service(cfg)
        report = service.validate(tmp_path)
        result = _to_response(report, file.filename)
        return JSONResponse(content=result.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)


# ── /render-snippet ──────────────────────────────────────────────────────────

# Цвет рамки подсветки (RGB в 0..1 для PyMuPDF). Тёплый красный.
_HIGHLIGHT_RGB = (0.93, 0.27, 0.27)
_HIGHLIGHT_WIDTH_PT = 1.5


@app.post("/render-snippet")
async def render_snippet(
    file: UploadFile = File(...),
    page: int = Form(..., ge=1),
    bbox: str = Form(...),
    padding_pt: float = Form(default=20.0, ge=0.0),
    dpi: int = Form(default=144, ge=36, le=600),
) -> Response:
    """
    Рендерит фрагмент страницы PDF с подсветкой bbox в PNG.

    `bbox` — JSON-массив `[x0, y0, x1, y1]` в координатах PDF (точки).
    Если bbox имеет нулевую площадь — рисуется вся страница без подсветки.
    """
    try:
        bbox_list = json.loads(bbox)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"bbox is not valid JSON: {exc}") from exc
    if not (isinstance(bbox_list, list) and len(bbox_list) == 4):
        raise HTTPException(status_code=400, detail="bbox must be [x0,y0,x1,y1]")
    try:
        bbox_rect = fitz.Rect(*[float(v) for v in bbox_list])
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"bbox values invalid: {exc}") from exc

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Файл пустой")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if page > doc.page_count:
            raise HTTPException(status_code=400, detail=f"page {page} > page_count {doc.page_count}")
        pdf_page = doc[page - 1]

        # Если bbox вырожденный — рендерим целую страницу без подсветки.
        has_highlight = bbox_rect.width > 0.1 and bbox_rect.height > 0.1

        if has_highlight:
            clip = fitz.Rect(
                max(bbox_rect.x0 - padding_pt, pdf_page.rect.x0),
                max(bbox_rect.y0 - padding_pt, pdf_page.rect.y0),
                min(bbox_rect.x1 + padding_pt, pdf_page.rect.x1),
                min(bbox_rect.y1 + padding_pt, pdf_page.rect.y1),
            )
            # draw_rect модифицирует страницу в памяти — на диск не сохраняем.
            pdf_page.draw_rect(bbox_rect, color=_HIGHLIGHT_RGB, width=_HIGHLIGHT_WIDTH_PT)
        else:
            clip = pdf_page.rect

        zoom = dpi / 72.0
        pix = pdf_page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
        png = pix.tobytes("png")
        return Response(content=png, media_type="image/png")
    finally:
        doc.close()
