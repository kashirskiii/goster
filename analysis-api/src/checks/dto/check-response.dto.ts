import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CheckErrorDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "FontValidator" })
  validator: string;

  @ApiProperty({ example: "FONT_VALIDATION_ERROR" })
  code: string;

  @ApiProperty({ enum: ["error", "warning"] })
  severity: string;

  @ApiPropertyOptional({ example: 3 })
  page: number | null;

  @ApiPropertyOptional({ description: "Фрагмент текста, в котором найдено несоответствие" })
  textPreview: string | null;

  @ApiPropertyOptional({ description: "Что ожидалось по требованиям ГОСТ" })
  expected: string | null;

  @ApiPropertyOptional({ description: "Что найдено по факту" })
  actual: string | null;

  @ApiProperty({ description: "Сводное сообщение (для логов / обратной совместимости)" })
  message: string;

  @ApiPropertyOptional({ description: "[x0,y0,x1,y1] координаты на странице" })
  bbox: unknown;
}

export class CheckResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  submissionId: string;

  @ApiProperty({ enum: ["pending", "processing", "done", "failed"] })
  status: string;

  @ApiPropertyOptional()
  pageCount: number | null;

  @ApiProperty()
  errorCount: number;

  @ApiProperty()
  warningCount: number;

  @ApiPropertyOptional({
    description: "Текст внутреннего сбоя пайплайна (если status=failed)",
  })
  failureReason: string | null;

  @ApiPropertyOptional()
  startedAt: Date | null;

  @ApiPropertyOptional()
  finishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [CheckErrorDto] })
  errors: CheckErrorDto[];
}
