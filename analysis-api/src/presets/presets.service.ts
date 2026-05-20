import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface UpsertInput {
  code?: string;
  name?: string;
  description?: string | null;
  config?: unknown;
}

@Injectable()
export class PresetsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.gostPreset.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, description: true, config: true },
    });
  }

  async create(role: string, input: UpsertInput) {
    this.assertTeacher(role);
    const code = (input.code ?? "").trim();
    const name = (input.name ?? "").trim();
    if (!code || !name) {
      throw new BadRequestException("code и name обязательны");
    }
    const config = this.assertConfig(input.config);

    try {
      return await this.prisma.gostPreset.create({
        data: {
          code,
          name,
          description: input.description?.trim() || null,
          config: config as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(`Пресет с code="${code}" уже существует`);
      }
      throw err;
    }
  }

  async update(id: string, role: string, input: UpsertInput) {
    this.assertTeacher(role);
    const existing = await this.prisma.gostPreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Пресет не найден");

    const data: Prisma.GostPresetUpdateInput = {};
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (!code) throw new BadRequestException("code не может быть пустым");
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException("name не может быть пустым");
      data.name = name;
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }
    if (input.config !== undefined) {
      data.config = this.assertConfig(input.config) as Prisma.InputJsonValue;
    }

    try {
      return await this.prisma.gostPreset.update({ where: { id }, data });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException("Пресет с таким code уже существует");
      }
      throw err;
    }
  }

  async remove(id: string, role: string) {
    this.assertTeacher(role);
    const existing = await this.prisma.gostPreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Пресет не найден");
    // Связанные диалоги хранят свой dialog.config как копию — удаление пресета
    // не ломает их (Dialog.presetId nullable, FK action = SetNull).
    await this.prisma.gostPreset.delete({ where: { id } });
    return { id };
  }

  private assertTeacher(role: string): void {
    if (role !== "teacher") {
      throw new ForbiddenException("Управлять пресетами может только преподаватель");
    }
  }

  private assertConfig(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("config должен быть JSON-объектом");
    }
    return value as Record<string, unknown>;
  }
}
