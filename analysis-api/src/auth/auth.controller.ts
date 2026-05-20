import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { AuthTokensResponseDto } from "./dto/auth-tokens.response.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Вход в систему", description: "Возвращает пару access/refresh токенов" })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: "Неверный email или пароль" })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<AuthTokensResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @ApiOperation({ summary: "Обновление токенов", description: "Принимает refresh token, возвращает новую пару. Старый токен аннулируется (ротация)" })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: "Токен недействителен, истёк или уже был использован" })
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: "Выход из системы", description: "Аннулирует переданный refresh token. Требует валидный access token в заголовке Authorization" })
  @ApiBearerAuth("access-token")
  @ApiOkResponse({ schema: { example: { message: "Logged out successfully" } } })
  @ApiUnauthorizedResponse({ description: "Access token отсутствует или недействителен, либо refresh token не найден" })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Request() req, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(req.user.userId, dto.refreshToken);
  }
}
