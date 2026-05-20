import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
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
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateDialogResponseDto } from "./dto/create-dialog-response.dto";
import { CreateDialogDto } from "./dto/create-dialog.dto";
import { DialogsService } from "./dialogs.service";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@ApiTags("Dialogs")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("dialogs")
export class DialogsController {
  constructor(private readonly dialogsService: DialogsService) {}

  @ApiOperation({
    summary: "Создать диалог",
    description:
      "Студент создаёт диалог с преподавателем и загружает первую версию работы. " +
      "Одновременно создаётся Submission v1 и запись File с путём к сохранённому файлу.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["teacherId", "title", "file"],
      properties: {
        teacherId: { type: "string", format: "uuid" },
        title: { type: "string", example: "Курсовая работа по алгоритмам" },
        comment: { type: "string", example: "Первая версия" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiCreatedResponse({ type: CreateDialogResponseDto })
  @ApiUnauthorizedResponse({ description: "Требуется авторизация" })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  create(
    @Request() req,
    @Body() dto: CreateDialogDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
  ): Promise<CreateDialogResponseDto> {
    return this.dialogsService.create(req.user.userId, dto, file);
  }

  @ApiOperation({ summary: "Список моих диалогов (где я student или teacher)" })
  @Get()
  list(@Request() req) {
    return this.dialogsService.listForUser(req.user.userId);
  }

  @ApiOperation({ summary: "Список преподавателей (для выбора при создании диалога)" })
  @Get("teachers")
  listTeachers() {
    return this.dialogsService.listTeachers();
  }

  @ApiOperation({ summary: "Один диалог" })
  @Get(":dialogId")
  findOne(@Request() req, @Param("dialogId", new ParseUUIDPipe()) dialogId: string) {
    return this.dialogsService.findOne(dialogId, req.user.userId);
  }

  @ApiOperation({
    summary: "Обновить конфиг ГОСТ-проверок",
    description: "Только преподаватель диалога. Конфиг применяется к новым submission.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["config"],
      properties: { config: { type: "object" } },
    },
  })
  @Patch(":dialogId/config")
  updateConfig(
    @Request() req,
    @Param("dialogId", new ParseUUIDPipe()) dialogId: string,
    @Body("config") config: unknown,
  ) {
    return this.dialogsService.updateConfig(dialogId, req.user.userId, config);
  }
}
