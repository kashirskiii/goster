import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { SubmissionResponseDto } from "./dto/submission-response.dto";
import { SubmissionsService } from "./submissions.service";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@ApiTags("Submissions")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @ApiOperation({
    summary: "Загрузить новую версию работы (новый pipeline)",
    description:
      "Студент добавляет новую версию документа в существующий диалог. " +
      "Создаётся Submission v(N+1), запускается автоматическая ГОСТ-проверка, " +
      "system-approval инициализируется в pending и переходит в approved/rejected по итогу.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        comment: { type: "string", example: "Учёл замечания по титульнику" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiCreatedResponse({ type: SubmissionResponseDto })
  @HttpCode(HttpStatus.CREATED)
  @Post("dialogs/:dialogId/submissions")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  create(
    @Request() req,
    @Param("dialogId", new ParseUUIDPipe()) dialogId: string,
    @Body() dto: CreateSubmissionDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.addToDialog(
      dialogId,
      req.user.userId,
      file,
      dto.comment,
    ) as Promise<SubmissionResponseDto>;
  }

  @ApiOperation({ summary: "Список сабмишенов диалога" })
  @ApiOkResponse({ type: [SubmissionResponseDto] })
  @Get("dialogs/:dialogId/submissions")
  list(
    @Request() req,
    @Param("dialogId", new ParseUUIDPipe()) dialogId: string,
  ): Promise<SubmissionResponseDto[]> {
    return this.submissions.listForDialog(dialogId, req.user.userId) as Promise<
      SubmissionResponseDto[]
    >;
  }

  @ApiOperation({ summary: "Один сабмишен с детальной информацией" })
  @ApiOkResponse({ type: SubmissionResponseDto })
  @Get("submissions/:submissionId")
  findOne(
    @Param("submissionId", new ParseUUIDPipe()) submissionId: string,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.findOne(submissionId) as Promise<SubmissionResponseDto>;
  }
}
