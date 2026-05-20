import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SubmissionFileDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  path: string;

  @ApiPropertyOptional()
  mimeType: string | null;

  @ApiPropertyOptional()
  size: number | null;
}

export class SubmissionApprovalDto {
  @ApiProperty({ enum: ["system", "teacher"] })
  type: string;

  @ApiProperty({ enum: ["pending", "approved", "rejected"] })
  status: string;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty()
  updatedAt: Date;
}

export class SubmissionCheckSummaryDto {
  @ApiProperty({ enum: ["pending", "processing", "done", "failed"] })
  status: string;

  @ApiProperty()
  errorCount: number;

  @ApiProperty()
  warningCount: number;
}

export class SubmissionResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  dialogId: string;

  @ApiProperty({ example: 2 })
  version: number;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [SubmissionFileDto] })
  files: SubmissionFileDto[];

  @ApiPropertyOptional({ type: SubmissionCheckSummaryDto })
  check: SubmissionCheckSummaryDto | null;

  @ApiProperty({ type: [SubmissionApprovalDto] })
  approvals: SubmissionApprovalDto[];
}
