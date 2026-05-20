import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateMessageDto {
  @ApiProperty({ example: "Исправил шрифт на 74-й странице." })
  content: string;
}

export class MessageAuthorDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional({ nullable: true })
  middleName: string | null;
}

export class MessageResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  dialogId: string;

  @ApiPropertyOptional({ format: "uuid" })
  authorId: string | null;

  @ApiProperty({ enum: ["student", "teacher", "system"] })
  authorType: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: MessageAuthorDto })
  author: MessageAuthorDto | null;
}
