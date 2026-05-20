// Маппинг кодов ошибок pdf-analysis-service в человекочитаемые заголовки.
// Пять фиксированных типов из ErrorType (см. pdf-analysis-service/core/models.py).
// Конкретные данные (фрагмент текста, ожидание, факт) приходят с бэка
// в полях textPreview/expected/actual — здесь только заголовки.

const TITLES: Record<string, string> = {
  FONT_VALIDATION_ERROR: "Несоответствие шрифта",
  PAGE_NUMBER_ERROR: "Ошибка нумерации страниц",
  FIGURE_CAPTION_ERROR: "Подпись рисунка не по ГОСТ",
  TOC_ERROR: "Несоответствие оглавления",
  STRUCTURAL_HEADING_ERROR: "Оформление заголовка",
};

/** Заголовок карточки ошибки. Если код незнакомый — оставляем как есть. */
export function errorTitle(code: string): string {
  return TITLES[code] ?? code;
}
