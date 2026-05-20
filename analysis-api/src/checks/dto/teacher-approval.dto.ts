import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ApprovalStatus } from "@prisma/client";

export class TeacherApprovalDto {
  @ApiProperty({ enum: [ApprovalStatus.approved, ApprovalStatus.rejected] })
  status: ApprovalStatus;

  @ApiPropertyOptional({ example: "Доработать титульный лист" })
  comment?: string;
}

export class ApprovalResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  submissionId: string;

  @ApiProperty({ enum: ["system", "teacher"] })
  type: string;

  @ApiProperty({ enum: ["pending", "approved", "rejected"] })
  status: string;

  @ApiPropertyOptional({ format: "uuid" })
  decidedById: string | null;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
