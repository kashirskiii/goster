import { ApiPropertyOptional } from "@nestjs/swagger";

export class CreateSubmissionDto {
  @ApiPropertyOptional({ example: "Учёл замечания по титульнику" })
  comment?: string;
}
