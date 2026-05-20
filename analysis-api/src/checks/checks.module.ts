import { Module } from "@nestjs/common";
import { CheckErrorsController } from "./check-errors.controller";
import { ChecksController } from "./checks.controller";
import { ChecksService } from "./checks.service";
import { PdfAnalysisClient } from "./pdf-analysis.client";

@Module({
  controllers: [ChecksController, CheckErrorsController],
  providers: [ChecksService, PdfAnalysisClient],
  exports: [ChecksService],
})
export class ChecksModule {}
