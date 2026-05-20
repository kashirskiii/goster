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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateMessageDto, MessageResponseDto } from "./dto/message.dto";
import { MessagesService } from "./messages.service";

@ApiTags("Messages")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller("dialogs/:dialogId/messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @ApiOperation({ summary: "Все сообщения диалога" })
  @ApiOkResponse({ type: [MessageResponseDto] })
  @Get()
  list(@Request() req, @Param("dialogId", new ParseUUIDPipe()) dialogId: string) {
    return this.messages.listForDialog(dialogId, req.user.userId);
  }

  @ApiOperation({ summary: "Отправить сообщение в диалог" })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @Request() req,
    @Param("dialogId", new ParseUUIDPipe()) dialogId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messages.create({
      dialogId,
      userId: req.user.userId,
      role: req.user.role,
      content: dto.content,
    });
  }
}
