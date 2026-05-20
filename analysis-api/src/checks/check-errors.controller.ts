import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChecksService } from "./checks.service";

@ApiTags("Check errors")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("check-errors")
export class CheckErrorsController {
  constructor(private readonly checks: ChecksService) {}

  @ApiOperation({
    summary: "PNG-фрагмент страницы PDF с подсветкой bbox ошибки",
    description:
      "Лениво рендерит и кэширует. Доступ только участникам диалога " +
      "(студент или преподаватель).",
  })
  @Header("Cache-Control", "private, max-age=3600")
  @Get(":id/snippet")
  async getSnippet(
    @Request() req,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.checks.getErrorSnippet(id, req.user.userId);
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  }
}
