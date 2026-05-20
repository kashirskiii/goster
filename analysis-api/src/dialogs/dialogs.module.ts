import { Module } from "@nestjs/common";
import { ChecksModule } from "../checks/checks.module";
import { SubmissionsModule } from "../submissions/submissions.module";
import { DialogsController } from "./dialogs.controller";
import { DialogsService } from "./dialogs.service";

@Module({
  imports: [ChecksModule, SubmissionsModule],
  controllers: [DialogsController],
  providers: [DialogsService],
})
export class DialogsModule {}
