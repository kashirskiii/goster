import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  ApprovalType,
  CheckStatus,
  ErrorSeverity,
  EventType,
  Prisma,
} from "@prisma/client";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { PdfAnalysisClient, PdfValidationReport } from "./pdf-analysis.client";

@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfAnalysis: PdfAnalysisClient,
  ) {}

  /**
   * Запустить pipeline: вычитать файл сабмишена, прогнать через pdf-analysis-service,
   * сохранить результаты, выставить system-approval. Не пробрасывает исключения —
   * любая ошибка пайплайна отражается в Check.status=failed + system-approval=rejected.
   */
  async runForSubmission(submissionId: string): Promise<void> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { files: true, check: true, dialog: { select: { config: true } } },
    });

    if (!submission) {
      this.logger.warn(`runForSubmission: submission ${submissionId} not found`);
      return;
    }
    if (!submission.check) {
      this.logger.warn(`runForSubmission: check for ${submissionId} missing`);
      return;
    }

    const file = submission.files[0];
    if (!file) {
      await this.markFailed(submission.check.id, submissionId, "Файл сабмишена отсутствует");
      return;
    }

    await this.prisma.check.update({
      where: { id: submission.check.id },
      data: { status: CheckStatus.processing, startedAt: new Date() },
    });
    await this.prisma.event.create({
      data: {
        dialogId: submission.dialogId,
        type: EventType.check_started,
        payload: { submissionId, checkId: submission.check.id },
      },
    });

    const config = submission.dialog?.config ?? null;
    if (config) {
      await this.prisma.check.update({
        where: { id: submission.check.id },
        data: { configSnapshot: config as unknown as Prisma.InputJsonValue },
      });
    }

    let report: PdfValidationReport;
    try {
      const absolutePath = join(process.cwd(), file.path);
      report = await this.pdfAnalysis.validate(absolutePath, file.originalName, config);
    } catch (err) {
      await this.markFailed(submission.check.id, submissionId, (err as Error).message);
      return;
    }

    await this.applyReport(submission.check.id, submissionId, submission.dialogId, report);
  }

  /** Преподаватель ставит approve/reject. */
  async setTeacherApproval(
    submissionId: string,
    teacherId: string,
    status: ApprovalStatus,
    comment?: string,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { dialog: true },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.dialog.teacherId !== teacherId) {
      throw new ForbiddenException("Only the assigned teacher can approve");
    }
    if (status !== ApprovalStatus.approved && status !== ApprovalStatus.rejected) {
      throw new ForbiddenException("status must be approved or rejected");
    }

    const approval = await this.prisma.approval.upsert({
      where: { submissionId_type: { submissionId, type: ApprovalType.teacher } },
      create: {
        submissionId,
        type: ApprovalType.teacher,
        status,
        decidedById: teacherId,
        comment,
      },
      update: { status, decidedById: teacherId, comment },
    });

    await this.prisma.event.create({
      data: {
        dialogId: submission.dialogId,
        actorId: teacherId,
        type: EventType.approval_updated,
        payload: { submissionId, type: "teacher", status },
      },
    });

    return approval;
  }

  async findCheckBySubmission(submissionId: string) {
    const check = await this.prisma.check.findUnique({
      where: { submissionId },
      include: { errors: { orderBy: [{ severity: "asc" }, { page: "asc" }] } },
    });
    if (!check) throw new NotFoundException("Check not found");
    return check;
  }

  /**
   * Возвращает PNG-снимок страницы PDF с подсветкой bbox конкретной ошибки.
   * Кэширует результат на диск в uploads/snippets/{checkErrorId}.png —
   * ошибки иммутабельны, инвалидация не нужна.
   */
  async getErrorSnippet(checkErrorId: string, userId: string): Promise<Buffer> {
    const error = await this.prisma.checkError.findUnique({
      where: { id: checkErrorId },
      include: {
        check: {
          include: {
            submission: {
              include: { files: true, dialog: { select: { studentId: true, teacherId: true } } },
            },
          },
        },
      },
    });
    if (!error) throw new NotFoundException("Check error not found");

    const dialog = error.check.submission.dialog;
    if (dialog.studentId !== userId && dialog.teacherId !== userId) {
      throw new ForbiddenException("Not a participant of this dialog");
    }

    const cachePath = join(process.cwd(), "uploads", "snippets", `${checkErrorId}.png`);
    if (existsSync(cachePath)) {
      return readFile(cachePath);
    }

    const file = error.check.submission.files[0];
    if (!file) {
      throw new BadRequestException("Submission has no file attached");
    }
    if (!error.page) {
      throw new BadRequestException("Error has no page reference");
    }
    const bbox = this.normalizeBbox(error.bbox);

    const absolutePath = join(process.cwd(), file.path);
    const png = await this.pdfAnalysis.renderSnippet(
      absolutePath,
      file.originalName,
      error.page,
      bbox,
    );

    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, png);
    return png;
  }

  private normalizeBbox(bbox: unknown): [number, number, number, number] {
    if (!Array.isArray(bbox) || bbox.length !== 4) return [0, 0, 0, 0];
    const nums = bbox.map((v) => (typeof v === "number" ? v : Number(v)));
    if (nums.some((n) => !Number.isFinite(n))) return [0, 0, 0, 0];
    return [nums[0], nums[1], nums[2], nums[3]];
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async applyReport(
    checkId: string,
    submissionId: string,
    dialogId: string,
    report: PdfValidationReport,
  ) {
    const errors: Prisma.CheckErrorCreateManyInput[] = [];
    for (const check of report.checks) {
      for (const issue of check.issues) {
        errors.push({
          checkId,
          validator: check.validator,
          code: issue.type,
          severity:
            issue.severity === "WARNING" ? ErrorSeverity.warning : ErrorSeverity.error,
          page: issue.page,
          textPreview: issue.text_preview || null,
          expected: issue.expected || null,
          actual: issue.actual || null,
          message: issue.message,
          bbox: issue.bbox as unknown as Prisma.InputJsonValue,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.checkError.deleteMany({ where: { checkId } });
      if (errors.length) {
        await tx.checkError.createMany({ data: errors });
      }

      await tx.check.update({
        where: { id: checkId },
        data: {
          status: CheckStatus.done,
          finishedAt: new Date(),
          pageCount: report.page_count,
          errorCount: report.total_errors,
          warningCount: report.total_warnings,
          report: report as unknown as Prisma.InputJsonValue,
          failureReason: null,
        },
      });

      await tx.approval.upsert({
        where: { submissionId_type: { submissionId, type: ApprovalType.system } },
        create: {
          submissionId,
          type: ApprovalType.system,
          status: report.is_valid ? ApprovalStatus.approved : ApprovalStatus.rejected,
          comment: report.is_valid
            ? "Автоматическая проверка ГОСТ пройдена"
            : `Найдено ошибок: ${report.total_errors}`,
        },
        update: {
          status: report.is_valid ? ApprovalStatus.approved : ApprovalStatus.rejected,
          comment: report.is_valid
            ? "Автоматическая проверка ГОСТ пройдена"
            : `Найдено ошибок: ${report.total_errors}`,
        },
      });
    });

    await this.prisma.event.create({
      data: {
        dialogId,
        type: EventType.check_completed,
        payload: {
          submissionId,
          checkId,
          isValid: report.is_valid,
          errors: report.total_errors,
          warnings: report.total_warnings,
        },
      },
    });
  }

  private async markFailed(checkId: string, submissionId: string, reason: string) {
    this.logger.error(`check ${checkId} failed: ${reason}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.check.update({
        where: { id: checkId },
        data: {
          status: CheckStatus.failed,
          finishedAt: new Date(),
          failureReason: reason,
        },
      });

      // system-approval = rejected при сбое пайплайна,
      // чтобы преподавателю было видно, что автоматическая проверка не прошла
      await tx.approval.upsert({
        where: { submissionId_type: { submissionId, type: ApprovalType.system } },
        create: {
          submissionId,
          type: ApprovalType.system,
          status: ApprovalStatus.rejected,
          comment: `Сбой автоматической проверки: ${reason}`,
        },
        update: {
          status: ApprovalStatus.rejected,
          comment: `Сбой автоматической проверки: ${reason}`,
        },
      });
    });

    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { dialogId: true },
    });
    if (submission) {
      await this.prisma.event.create({
        data: {
          dialogId: submission.dialogId,
          type: EventType.check_failed,
          payload: { submissionId, checkId, reason },
        },
      });
    }
  }
}
