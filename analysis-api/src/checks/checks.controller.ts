import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChecksService } from "./checks.service";
import { CheckResponseDto } from "./dto/check-response.dto";
import { ApprovalResponseDto, TeacherApprovalDto } from "./dto/teacher-approval.dto";

@ApiTags("Checks")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Требуется авторизация" })
@UseGuards(JwtAuthGuard)
@Controller("submissions/:submissionId")
export class ChecksController {
  constructor(private readonly checks: ChecksService) {}

  @ApiOperation({
    summary: "Получить отчёт автоматической проверки",
    description: "Полный результат прогона pdf-analysis-service по сабмишену.",
  })
  @ApiOkResponse({ type: CheckResponseDto })
  @ApiNotFoundResponse()
  @Get("check")
  getCheck(
    @Param("submissionId", new ParseUUIDPipe()) submissionId: string,
  ): Promise<CheckResponseDto> {
    return this.checks.findCheckBySubmission(submissionId) as Promise<CheckResponseDto>;
  }

  @ApiOperation({
    summary: "Решение преподавателя",
    description:
      "Преподаватель ставит approve/reject для сабмишена. " +
      "Ручное решение независимо от автоматической проверки ГОСТ.",
  })
  @ApiOkResponse({ type: ApprovalResponseDto })
  @ApiForbiddenResponse({ description: "Только закреплённый преподаватель может одобрять" })
  @HttpCode(HttpStatus.OK)
  @Post("approval")
  approve(
    @Request() req,
    @Param("submissionId", new ParseUUIDPipe()) submissionId: string,
    @Body() dto: TeacherApprovalDto,
  ): Promise<ApprovalResponseDto> {
    return this.checks.setTeacherApproval(
      submissionId,
      req.user.userId,
      dto.status,
      dto.comment,
    ) as Promise<ApprovalResponseDto>;
  }
}
