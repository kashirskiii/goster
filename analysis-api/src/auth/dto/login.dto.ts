import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "teacher@example.com" })
  email: string;

  @ApiProperty({ example: "teacher-password" })
  password: string;
}
