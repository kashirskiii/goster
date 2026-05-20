import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ApprovalType, EventType, MessageAuthorType } from "@prisma/client";
import { randomUUID } from "crypto";
import { ChecksService } from "../checks/checks.service";
import { PrismaService } from "../prisma/prisma.service";
import { FileStorage } from "./file-storage";

export function buildSubmissionAddedMessage(version: number, comment?: string | null): string {
  const head = `Загружена версия v${version}`;
  const trimmed = comment?.trim();
  return trimmed ? `${head}\n«${trimmed}»` : head;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly checks: ChecksService,
  ) {}

  /** Создать новый сабмишен (новый pipeline) внутри существующего диалога. */
  async addToDialog(
    dialogId: string,
    studentId: string,
    file: Express.Multer.File,
    comment?: string,
  ) {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      select: {
        id: true,
        studentId: true,
        status: true,
        submissions: { select: { version: true }, orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!dialog) throw new NotFoundException("Dialog not found");
    if (dialog.studentId !== studentId) {
      throw new ForbiddenException("Only the dialog owner can add submissions");
    }
    if (dialog.status === "closed" || dialog.status === "approved") {
      throw new BadRequestException(`Dialog is ${dialog.status}`);
    }

    const nextVersion = (dialog.submissions[0]?.version ?? 0) + 1;
    const submissionId = randomUUID();
    const stored = await this.storage.saveSubmissionFile(dialogId, submissionId, file);

    const submission = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          id: submissionId,
          dialogId,
          version: nextVersion,
          comment: comment ?? null,
        },
      });

      await tx.file.create({
        data: {
          submissionId: submission.id,
          originalName: file.originalname,
          path: stored.relativePath,
          mimeType: file.mimetype,
          size: file.size,
        },
      });

      // Создаём Check и оба Approval сразу: pipeline стартует в pending состоянии
      await tx.check.create({ data: { submissionId: submission.id } });
      await tx.approval.createMany({
        data: [
          { submissionId: submission.id, type: ApprovalType.system },
          { submissionId: submission.id, type: ApprovalType.teacher },
        ],
      });

      await tx.event.create({
        data: {
          dialogId,
          actorId: studentId,
          type: EventType.submission_added,
          payload: { submissionId: submission.id, version: nextVersion },
        },
      });

      await tx.message.create({
        data: {
          dialogId,
          authorId: null,
          authorType: MessageAuthorType.system,
          content: buildSubmissionAddedMessage(nextVersion, comment),
        },
      });

      return submission;
    });

    this.kickoffPipeline(submission.id);
    return this.findOne(submission.id);
  }

  async findOne(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        files: true,
        check: { include: { errors: true } },
        approvals: true,
      },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    return submission;
  }

  async listForDialog(dialogId: string, userId: string) {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      select: { studentId: true, teacherId: true },
    });
    if (!dialog) throw new NotFoundException("Dialog not found");
    if (dialog.studentId !== userId && dialog.teacherId !== userId) {
      throw new ForbiddenException("Not a participant of this dialog");
    }

    return this.prisma.submission.findMany({
      where: { dialogId },
      include: {
        files: true,
        check: { select: { status: true, errorCount: true, warningCount: true } },
        approvals: true,
      },
      orderBy: { version: "desc" },
    });
  }

  /**
   * Запускает pipeline в фоне. Endpoint возвращается сразу с pending-сабмишеном,
   * клиент опрашивает GET /submissions/:id/check для прогресса.
   */
  private kickoffPipeline(submissionId: string): void {
    setImmediate(() => {
      this.checks.runForSubmission(submissionId).catch((err) => {
        this.logger.error(
          `pipeline crashed for submission ${submissionId}: ${(err as Error).message}`,
        );
      });
    });
  }
}
