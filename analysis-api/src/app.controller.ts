import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("App")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: "Hello world" })
  @ApiOkResponse({ schema: { type: "string", example: "Hello from Analysis API!" } })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({ summary: "Health check", description: "Возвращает статус сервиса и текущее время сервера" })
  @ApiOkResponse({
    schema: {
      example: { status: "ok", timestamp: "2026-05-03T14:00:00.000Z" },
    },
  })
  @Get("health")
  getHealth() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
