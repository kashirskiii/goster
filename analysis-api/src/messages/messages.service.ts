import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MessageAuthorType, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Все сообщения диалога, упорядочены по времени. */
  async listForDialog(dialogId: string, userId: string) {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      select: { studentId: true, teacherId: true },
    });
    if (!dialog) throw new NotFoundException("Dialog not found");
    if (dialog.studentId !== userId && dialog.teacherId !== userId) {
      throw new ForbiddenException("Not a participant of this dialog");
    }

    return this.prisma.message.findMany({
      where: { dialogId },
      include: {
        author: { select: { id: true, email: true, lastName: true, firstName: true, middleName: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Отправить сообщение в диалог. */
  async create(params: {
    dialogId: string;
    userId: string;
    role: UserRole;
    content: string;
  }) {
    const trimmed = params.content?.trim();
    if (!trimmed) throw new BadRequestException("Сообщение пустое");
    if (trimmed.length > 5000) {
      throw new BadRequestException("Сообщение слишком длинное (макс. 5000)");
    }

    const dialog = await this.prisma.dialog.findUnique({
      where: { id: params.dialogId },
      select: { studentId: true, teacherId: true },
    });
    if (!dialog) throw new NotFoundException("Dialog not found");
    if (params.userId !== dialog.studentId && params.userId !== dialog.teacherId) {
      throw new ForbiddenException("Not a participant of this dialog");
    }

    const authorType =
      params.role === UserRole.teacher
        ? MessageAuthorType.teacher
        : MessageAuthorType.student;

    return this.prisma.message.create({
      data: {
        dialogId: params.dialogId,
        authorId: params.userId,
        authorType,
        content: trimmed,
      },
      include: { author: { select: { id: true, email: true, lastName: true, firstName: true, middleName: true } } },
    });
  }
}
