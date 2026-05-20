import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PresetsService } from "./presets.service";

interface UpsertBody {
  code?: string;
  name?: string;
  description?: string | null;
  config?: unknown;
}

@ApiTags("Presets")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller("gost-presets")
export class PresetsController {
  constructor(private readonly presets: PresetsService) {}

  @ApiOperation({ summary: "Список ГОСТ-пресетов для выбора при создании диалога" })
  @Get()
  list() {
    return this.presets.list();
  }

  @ApiOperation({ summary: "Создать пресет (только teacher)" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["code", "name", "config"],
      properties: {
        code: { type: "string", example: "gost-7.32-2017" },
        name: { type: "string", example: "ГОСТ 7.32-2017" },
        description: { type: "string" },
        config: { type: "object" },
      },
    },
  })
  @Post()
  create(@Request() req, @Body() body: UpsertBody) {
    return this.presets.create(req.user.role, body);
  }

  @ApiOperation({ summary: "Обновить пресет (только teacher)" })
  @Patch(":id")
  update(
    @Request() req,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpsertBody,
  ) {
    return this.presets.update(id, req.user.role, body);
  }

  @ApiOperation({ summary: "Удалить пресет (только teacher)" })
  @Delete(":id")
  remove(@Request() req, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.presets.remove(id, req.user.role);
  }
}
