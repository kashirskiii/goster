import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ApprovalType, EventType } from "@prisma/client";
import { ChecksService } from "../checks/checks.service";
import { FileStorage } from "./file-storage";
import { SubmissionsService } from "./submissions.service";

/**
 * Покрываем критичные инварианты MR-флоу:
 *  - ownership и блокировка closed/approved диалогов
 *  - инкремент версии (next = max + 1)
 *  - транзакция содержит submission + file + check + 2 approvals + event
 *  - kickoffPipeline дёргает ChecksService после транзакции
 */

const makePrismaMock = () => {
  const tx = {
    submission: { create: jest.fn() },
    file: { create: jest.fn() },
    check: { create: jest.fn() },
    approval: { createMany: jest.fn() },
    event: { create: jest.fn() },
    message: { create: jest.fn() },
  };
  return {
    dialog: { findUnique: jest.fn() },
    submission: { findUnique: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    __tx: tx,
  };
};

const makeFile = (): Express.Multer.File =>
  ({
    originalname: "doc.pdf",
    mimetype: "application/pdf",
    size: 1234,
    buffer: Buffer.from("pdf"),
  } as any);

const makeService = () => {
  const prisma = makePrismaMock();
  const storage: jest.Mocked<FileStorage> = {
    saveSubmissionFile: jest.fn().mockResolvedValue({
      relativePath: "uploads/dialogs/d/submissions/s/doc.pdf",
      safeFilename: "doc.pdf",
    }),
  } as any;
  const checks: jest.Mocked<Pick<ChecksService, "runForSubmission">> = {
    runForSubmission: jest.fn().mockResolvedValue(undefined),
  } as any;
  const service = new SubmissionsService(prisma as any, storage, checks as any);
  return { service, prisma, storage, checks };
};

describe("SubmissionsService.addToDialog", () => {
  it("404 если dialog не найден", async () => {
    const { service, prisma } = makeService();
    prisma.dialog.findUnique.mockResolvedValue(null);

    await expect(
      service.addToDialog("dlg", "stu", makeFile()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("403 если submission добавляет не владелец диалога", async () => {
    const { service, prisma } = makeService();
    prisma.dialog.findUnique.mockResolvedValue({
      id: "dlg",
      studentId: "real-student",
      status: "open",
      submissions: [],
    });

    await expect(
      service.addToDialog("dlg", "imposter", makeFile()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(["closed", "approved"] as const)(
    "400 если dialog.status=%s",
    async (status) => {
      const { service, prisma } = makeService();
      prisma.dialog.findUnique.mockResolvedValue({
        id: "dlg",
        studentId: "stu",
        status,
        submissions: [],
      });

      await expect(
        service.addToDialog("dlg", "stu", makeFile()),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it("счётчик версии: первый submission → v1, после v3 → v4", async () => {
    const { service, prisma } = makeService();
    prisma.dialog.findUnique.mockResolvedValueOnce({
      id: "dlg",
      studentId: "stu",
      status: "open",
      submissions: [{ version: 3 }],
    });
    prisma.__tx.submission.create.mockImplementation(async (args: any) => ({
      id: args.data.id,
      version: args.data.version,
      dialogId: args.data.dialogId,
    }));
    prisma.submission.findUnique.mockResolvedValue({
      id: "sid",
      version: 4,
    });

    await service.addToDialog("dlg", "stu", makeFile(), "v4 comment");

    expect(prisma.__tx.submission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 4, comment: "v4 comment" }),
    });
  });

  it("первый submission в пустом диалоге → version=1", async () => {
    const { service, prisma } = makeService();
    prisma.dialog.findUnique.mockResolvedValueOnce({
      id: "dlg",
      studentId: "stu",
      status: "open",
      submissions: [],
    });
    prisma.__tx.submission.create.mockImplementation(async (args: any) => ({
      id: args.data.id,
      version: args.data.version,
    }));
    prisma.submission.findUnique.mockResolvedValue({ id: "sid" });

    await service.addToDialog("dlg", "stu", makeFile());

    expect(prisma.__tx.submission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 1 }),
    });
  });

  it("транзакция создаёт submission + file + check + system+teacher approvals + event", async () => {
    const { service, prisma, storage } = makeService();
    prisma.dialog.findUnique.mockResolvedValueOnce({
      id: "dlg",
      studentId: "stu",
      status: "open",
      submissions: [],
    });
    prisma.__tx.submission.create.mockImplementation(async (args: any) => ({
      id: args.data.id,
      version: 1,
    }));
    prisma.submission.findUnique.mockResolvedValue({ id: "sid", version: 1 });

    await service.addToDialog("dlg", "stu", makeFile(), "v1");

    expect(storage.saveSubmissionFile).toHaveBeenCalled();
    expect(prisma.__tx.file.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalName: "doc.pdf",
        mimeType: "application/pdf",
        size: 1234,
      }),
    });
    expect(prisma.__tx.check.create).toHaveBeenCalled();
    expect(prisma.__tx.approval.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ type: ApprovalType.system }),
        expect.objectContaining({ type: ApprovalType.teacher }),
      ],
    });
    expect(prisma.__tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: EventType.submission_added }),
    });
    expect(prisma.__tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dialogId: "dlg",
        authorType: "system",
        content: expect.stringContaining("v1"),
      }),
    });
  });

  it("kickoffPipeline вызывает ChecksService.runForSubmission после транзакции", async () => {
    const { service, prisma, checks } = makeService();
    prisma.dialog.findUnique.mockResolvedValueOnce({
      id: "dlg",
      studentId: "stu",
      status: "open",
      submissions: [],
    });
    prisma.__tx.submission.create.mockImplementation(async (args: any) => ({
      id: args.data.id,
      version: 1,
    }));
    prisma.submission.findUnique.mockResolvedValue({ id: "sid", version: 1 });

    await service.addToDialog("dlg", "stu", makeFile());

    // setImmediate — выполнить очередь
    await new Promise((resolve) => setImmediate(resolve));

    expect(checks.runForSubmission).toHaveBeenCalledTimes(1);
    expect(checks.runForSubmission).toHaveBeenCalledWith(expect.any(String));
  });

  it("ошибка фонового pipeline не должна валить запрос", async () => {
    const { service, prisma, checks } = makeService();
    prisma.dialog.findUnique.mockResolvedValueOnce({
      id: "dlg",
      studentId: "stu",
      status: "open",
      submissions: [],
    });
    prisma.__tx.submission.create.mockImplementation(async (args: any) => ({
      id: args.data.id,
      version: 1,
    }));
    prisma.submission.findUnique.mockResolvedValue({ id: "sid", version: 1 });
    checks.runForSubmission.mockRejectedValue(new Error("pdf-service down"));

    // request не должен бросать, даже если pipeline упадёт
    await expect(service.addToDialog("dlg", "stu", makeFile())).resolves.toBeDefined();
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe("SubmissionsService.findOne / listForDialog", () => {
  it("findOne 404 если submission не существует", async () => {
    const { service, prisma } = makeService();
    prisma.submission.findUnique.mockResolvedValue(null);

    await expect(service.findOne("ghost")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("listForDialog 403 для постороннего пользователя", async () => {
    const { service, prisma } = makeService();
    prisma.dialog.findUnique.mockResolvedValue({
      studentId: "stu",
      teacherId: "tea",
    });

    await expect(service.listForDialog("dlg", "outsider")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
