import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { createReadStream } from "fs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FilesService } from "./files.service";

@ApiTags("Files")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller("files")
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @ApiOperation({
    summary: "Скачать файл сабмишена",
    description:
      "Доступно студенту-владельцу диалога и закреплённому преподавателю. " +
      "Возвращает оригинальный PDF с Content-Disposition: attachment.",
  })
  @ApiOkResponse({ description: "Файл (binary stream)" })
  @ApiForbiddenResponse({ description: "Не участник диалога" })
  @ApiNotFoundResponse({ description: "Файл не найден" })
  @Get(":fileId")
  async download(
    @Request() req,
    @Param("fileId", new ParseUUIDPipe()) fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const f = await this.filesService.resolveForUser(fileId, req.user.userId);

    // RFC 5987 — корректное имя для не-ASCII (кириллица)
    const encoded = encodeURIComponent(f.originalName);
    res.set({
      "Content-Type": f.mimeType,
      "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      ...(f.size ? { "Content-Length": String(f.size) } : {}),
    });

    return new StreamableFile(createReadStream(f.absolutePath));
  }
}
