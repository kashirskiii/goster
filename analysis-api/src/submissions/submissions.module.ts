import { Module } from "@nestjs/common";
import { ChecksModule } from "../checks/checks.module";
import { FileStorage } from "./file-storage";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";

@Module({
  imports: [ChecksModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, FileStorage],
  exports: [SubmissionsService, FileStorage],
})
export class SubmissionsModule {}
