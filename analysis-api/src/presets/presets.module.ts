import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PresetsController } from "./presets.controller";
import { PresetsService } from "./presets.service";

@Module({
  imports: [PrismaModule],
  controllers: [PresetsController],
  providers: [PresetsService],
})
export class PresetsModule {}
