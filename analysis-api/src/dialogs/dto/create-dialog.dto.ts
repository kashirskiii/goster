import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateDialogDto {
  @ApiProperty({ description: "UUID преподавателя", format: "uuid" })
  teacherId: string;

  @ApiProperty({ example: "Курсовая работа по алгоритмам" })
  title: string;

  @ApiPropertyOptional({ example: "Первая версия работы" })
  comment?: string;

  @ApiPropertyOptional({ description: "UUID пресета ГОСТ-конфига", format: "uuid" })
  presetId?: string;
}
