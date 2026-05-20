import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { stat } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Возвращает абсолютный путь и метаданные файла, если user — участник
   * диалога (student или teacher). Иначе 403/404.
   */
  async resolveForUser(fileId: string, userId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        submission: { include: { dialog: { select: { studentId: true, teacherId: true } } } },
      },
    });
    if (!file) throw new NotFoundException("File not found");

    const { studentId, teacherId } = file.submission.dialog;
    if (userId !== studentId && userId !== teacherId) {
      throw new ForbiddenException("Not a participant of this dialog");
    }

    const absolutePath = join(process.cwd(), file.path);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException("File missing on disk");
    }

    return {
      absolutePath,
      originalName: file.originalName,
      mimeType: file.mimeType ?? "application/octet-stream",
      size: file.size ?? undefined,
    };
  }
}
