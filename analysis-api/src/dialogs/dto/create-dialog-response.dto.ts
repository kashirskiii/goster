import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DialogFileDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty({ description: "Относительный путь для получения файла: GET /api/files/:path" })
  path: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  mimeType: string | null;

  @ApiPropertyOptional({ description: "Размер в байтах" })
  size: number | null;

  @ApiProperty()
  createdAt: Date;
}

export class DialogSubmissionDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  dialogId: string;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class DialogDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  studentId: string;

  @ApiProperty({ format: "uuid" })
  teacherId: string;

  @ApiProperty({ example: "Курсовая работа по алгоритмам" })
  title: string;

  @ApiProperty({ enum: ["open", "approved", "rejected", "closed"], example: "open" })
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class CreateDialogResponseDto {
  @ApiProperty({ type: DialogDto })
  dialog: DialogDto;

  @ApiProperty({ type: DialogSubmissionDto })
  submission: DialogSubmissionDto;

  @ApiProperty({ type: DialogFileDto })
  file: DialogFileDto;
}
