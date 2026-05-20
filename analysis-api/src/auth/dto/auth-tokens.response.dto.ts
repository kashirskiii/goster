import { ApiProperty } from "@nestjs/swagger";

export class AuthTokensResponseDto {
  @ApiProperty({ description: "JWT access token (15m)" })
  accessToken: string;

  @ApiProperty({ description: "JWT refresh token (7d)" })
  refreshToken: string;
}
