import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ApprovalType, EventType, MessageAuthorType } from "@prisma/client";
import { randomUUID } from "crypto";
import { ChecksService } from "../checks/checks.service";
import { PrismaService } from "../prisma/prisma.service";
import { FileStorage } from "../submissions/file-storage";
import { buildSubmissionAddedMessage } from "../submissions/submissions.service";
import { CreateDialogDto } from "./dto/create-dialog.dto";

@Injectable()
export class DialogsService {
  private readonly logger = new Logger(DialogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly checks: ChecksService,
  ) {}

  async create(
    studentId: string,
    dto: CreateDialogDto,
    file: Express.Multer.File,
  ) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, role: true },
    });

    if (!teacher || teacher.role !== "teacher") {
      throw new BadRequestException("Teacher not found");
    }

    let presetId: string | null = null;
    let dialogConfig: unknown = null;
    if (dto.presetId) {
      const preset = await this.prisma.gostPreset.findUnique({
        where: { id: dto.presetId },
        select: { id: true, config: true },
      });
      if (!preset) throw new BadRequestException("Preset not found");
      presetId = preset.id;
      dialogConfig = preset.config;
    }

    const dialogId = randomUUID();
    const submissionId = randomUUID();
    const stored = await this.storage.saveSubmissionFile(dialogId, submissionId, file);

    const result = await this.prisma.$transaction(async (tx) => {
      const dialog = await tx.dialog.create({
        data: {
          id: dialogId,
          studentId,
          teacherId: dto.teacherId,
          title: dto.title,
          presetId,
          config: dialogConfig as never,
        },
      });

      const submission = await tx.submission.create({
        data: {
          id: submissionId,
          dialogId: dialog.id,
          version: 1,
          comment: dto.comment ?? null,
        },
      });

      const fileRecord = await tx.file.create({
        data: {
          submissionId: submission.id,
          originalName: file.originalname,
          path: stored.relativePath,
          mimeType: file.mimetype,
          size: file.size,
        },
      });

      await tx.check.create({ data: { submissionId: submission.id } });
      await tx.approval.createMany({
        data: [
          { submissionId: submission.id, type: ApprovalType.system },
          { submissionId: submission.id, type: ApprovalType.teacher },
        ],
      });

      await tx.event.createMany({
        data: [
          {
            dialogId: dialog.id,
            actorId: studentId,
            type: EventType.dialog_created,
            payload: { teacherId: dto.teacherId, title: dto.title },
          },
          {
            dialogId: dialog.id,
            actorId: studentId,
            type: EventType.submission_added,
            payload: { submissionId: submission.id, version: 1 },
          },
        ],
      });

      await tx.message.create({
        data: {
          dialogId: dialog.id,
          authorId: null,
          authorType: MessageAuthorType.system,
          content: buildSubmissionAddedMessage(1, dto.comment),
        },
      });

      return { dialog, submission, file: fileRecord };
    });

    this.kickoffPipeline(submissionId);
    return result;
  }

  /** Список диалогов где user — студент или преподаватель. */
  async listForUser(userId: string) {
    return this.prisma.dialog.findMany({
      where: { OR: [{ studentId: userId }, { teacherId: userId }] },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, email: true, lastName: true, firstName: true, middleName: true } },
        teacher: { select: { id: true, email: true, lastName: true, firstName: true, middleName: true } },
        submissions: {
          select: {
            id: true,
            version: true,
            createdAt: true,
            check: { select: { status: true, errorCount: true, warningCount: true } },
            approvals: { select: { type: true, status: true } },
          },
          orderBy: { version: "desc" },
          take: 1,
        },
        _count: { select: { submissions: true } },
      },
    });
  }

  async findOne(dialogId: string, userId: string) {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      include: {
        student: { select: { id: true, email: true, lastName: true, firstName: true, middleName: true } },
        teacher: { select: { id: true, email: true, lastName: true, firstName: true, middleName: true } },
        preset: { select: { id: true, code: true, name: true } },
      },
    });
    if (!dialog) throw new NotFoundException("Dialog not found");
    if (dialog.studentId !== userId && dialog.teacherId !== userId) {
      throw new ForbiddenException("Not a participant of this dialog");
    }
    return dialog;
  }

  async updateConfig(dialogId: string, userId: string, config: unknown) {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      select: { id: true, teacherId: true, status: true },
    });
    if (!dialog) throw new NotFoundException("Dialog not found");
    if (dialog.teacherId !== userId) {
      throw new ForbiddenException("Только преподаватель диалога может менять конфиг");
    }
    if (dialog.status !== "open") {
      throw new BadRequestException("Конфиг можно менять только в открытом диалоге");
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new BadRequestException("config должен быть JSON-объектом");
    }
    return this.prisma.dialog.update({
      where: { id: dialogId },
      data: { config: config as never },
      select: { id: true, config: true },
    });
  }

  /** Список преподавателей для UI создания диалога. */
  async listTeachers() {
    return this.prisma.user.findMany({
      where: { role: "teacher" },
      select: { id: true, email: true, lastName: true, firstName: true, middleName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

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
