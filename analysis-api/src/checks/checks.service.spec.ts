import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, ApprovalType, CheckStatus, ErrorSeverity } from "@prisma/client";
import { ChecksService } from "./checks.service";
import { PdfAnalysisClient, PdfValidationReport } from "./pdf-analysis.client";

/**
 * Что покрываем — критичная бизнес-логика pipeline:
 *  - applyReport: маппинг отчёта в CheckError[] и system-approval
 *  - markFailed: сбой HTTP-клиента не пробрасывается, approval=rejected
 *  - setTeacherApproval: ownership и валидация status
 *  - findCheckBySubmission: 404
 *
 * Prisma и pdf-client мокаются: проверяем именно поведение сервиса,
 * а не интеграцию с БД (последняя покрыта smoke-тестом).
 */

const buildReport = (overrides: Partial<PdfValidationReport> = {}): PdfValidationReport => ({
  document: "test.pdf",
  page_count: 10,
  is_valid: true,
  total_errors: 0,
  total_warnings: 0,
  checks: [],
  ...overrides,
});

const makePrismaMock = () => {
  const tx = {
    checkError: { deleteMany: jest.fn(), createMany: jest.fn() },
    check: { update: jest.fn() },
    approval: { upsert: jest.fn() },
  };
  return {
    submission: { findUnique: jest.fn() },
    check: { update: jest.fn(), findUnique: jest.fn() },
    approval: { upsert: jest.fn() },
    event: { create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    __tx: tx,
  };
};

type PrismaMock = ReturnType<typeof makePrismaMock>;

const makeService = (prisma: PrismaMock, pdf: Partial<PdfAnalysisClient> = {}) => {
  const client = { validate: jest.fn(), health: jest.fn(), ...pdf } as any;
  return { service: new ChecksService(prisma as any, client), client };
};

describe("ChecksService", () => {
  // ─────────────────────────── applyReport / runForSubmission ───────────────────────────

  describe("runForSubmission", () => {
    const submissionWithFile = (overrides: any = {}) => ({
      id: "sub-1",
      dialogId: "dlg-1",
      files: [{ id: "f-1", path: "uploads/x.pdf", originalName: "x.pdf" }],
      check: { id: "chk-1", status: CheckStatus.pending },
      ...overrides,
    });

    it("happy path: is_valid=true → status=done, system-approval=approved", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue(submissionWithFile());
      const { service, client } = makeService(prisma);
      client.validate.mockResolvedValue(
        buildReport({
          page_count: 5,
          is_valid: true,
          total_errors: 0,
          total_warnings: 0,
          checks: [
            { validator: "FontValidator", is_valid: true, error_count: 0, warning_count: 0, issues: [] },
          ],
        }),
      );

      await service.runForSubmission("sub-1");

      expect(client.validate).toHaveBeenCalledWith(
        expect.stringContaining("uploads/x.pdf"),
        "x.pdf",
        null,
      );

      // 1) Check переведён в processing перед вызовом pdf-сервиса
      expect(prisma.check.update).toHaveBeenCalledWith({
        where: { id: "chk-1" },
        data: expect.objectContaining({ status: CheckStatus.processing }),
      });

      // 2) Внутри транзакции Check.status=done и approval=approved
      expect(prisma.__tx.check.update).toHaveBeenCalledWith({
        where: { id: "chk-1" },
        data: expect.objectContaining({
          status: CheckStatus.done,
          errorCount: 0,
          warningCount: 0,
          pageCount: 5,
          failureReason: null,
        }),
      });
      expect(prisma.__tx.approval.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: ApprovalType.system,
            status: ApprovalStatus.approved,
          }),
          update: expect.objectContaining({ status: ApprovalStatus.approved }),
        }),
      );
    });

    it("is_valid=false → status=done, system-approval=rejected, errors сохранены", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue(submissionWithFile());
      const { service, client } = makeService(prisma);
      client.validate.mockResolvedValue(
        buildReport({
          is_valid: false,
          total_errors: 2,
          total_warnings: 1,
          checks: [
            {
              validator: "FontValidator",
              is_valid: false,
              error_count: 2,
              warning_count: 0,
              issues: [
                { severity: "ERROR", type: "FONT", page: 1, text_preview: "x", expected: "Times 14pt", actual: "Times 9pt", message: "m1", bbox: [0, 0, 1, 1] },
                { severity: "ERROR", type: "FONT", page: 2, text_preview: "y", expected: "Times 14pt", actual: "Arial 10pt", message: "m2", bbox: [0, 0, 1, 1] },
              ],
            },
            {
              validator: "PageNumberValidator",
              is_valid: true,
              error_count: 0,
              warning_count: 1,
              issues: [
                { severity: "WARNING", type: "PAGE", page: 5, text_preview: "", expected: "«5»", actual: "номер отсутствует", message: "w1", bbox: [0, 0, 1, 1] },
              ],
            },
          ],
        }),
      );

      await service.runForSubmission("sub-1");

      // approval rejected
      expect(prisma.__tx.approval.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: ApprovalStatus.rejected }),
        }),
      );

      // CheckError маппинг: 3 issue, severity-маппинг WARNING→warning
      const createCall = prisma.__tx.checkError.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(3);
      const severities = createCall.data.map((d: any) => d.severity);
      expect(severities).toEqual([
        ErrorSeverity.error,
        ErrorSeverity.error,
        ErrorSeverity.warning,
      ]);
      // validator-имя проброшено
      expect(createCall.data[0].validator).toBe("FontValidator");
      expect(createCall.data[2].validator).toBe("PageNumberValidator");
      // деление перед вставкой — переигровка прошлого результата
      expect(prisma.__tx.checkError.deleteMany).toHaveBeenCalledWith({
        where: { checkId: "chk-1" },
      });
    });

    it("submission без файла → markFailed, system-approval=rejected, не вызывает pdf-client", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique
        .mockResolvedValueOnce(submissionWithFile({ files: [] }))
        // markFailed делает повторный поиск чтобы записать event
        .mockResolvedValueOnce({ dialogId: "dlg-1" });
      const { service, client } = makeService(prisma);

      await service.runForSubmission("sub-1");

      expect(client.validate).not.toHaveBeenCalled();
      expect(prisma.__tx.check.update).toHaveBeenCalledWith({
        where: { id: "chk-1" },
        data: expect.objectContaining({
          status: CheckStatus.failed,
          failureReason: "Файл сабмишена отсутствует",
        }),
      });
      expect(prisma.__tx.approval.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: ApprovalType.system,
            status: ApprovalStatus.rejected,
          }),
        }),
      );
    });

    it("pdf-client throws → markFailed, не пробрасывает исключение", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique
        .mockResolvedValueOnce(submissionWithFile())
        .mockResolvedValueOnce({ dialogId: "dlg-1" });
      const { service, client } = makeService(prisma);
      client.validate.mockRejectedValue(new Error("connection refused"));

      await expect(service.runForSubmission("sub-1")).resolves.toBeUndefined();

      expect(prisma.__tx.check.update).toHaveBeenCalledWith({
        where: { id: "chk-1" },
        data: expect.objectContaining({
          status: CheckStatus.failed,
          failureReason: "connection refused",
        }),
      });
    });

    it("submission не найден → silent return", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue(null);
      const { service, client } = makeService(prisma);

      await service.runForSubmission("ghost");

      expect(client.validate).not.toHaveBeenCalled();
      expect(prisma.check.update).not.toHaveBeenCalled();
    });

    it("submission без check (рассинхрон) → silent return, не падает", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue(submissionWithFile({ check: null }));
      const { service, client } = makeService(prisma);

      await service.runForSubmission("sub-1");

      expect(client.validate).not.toHaveBeenCalled();
      expect(prisma.check.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────── setTeacherApproval ───────────────────────────

  describe("setTeacherApproval", () => {
    it("404 если submission не найдена", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue(null);
      const { service } = makeService(prisma);

      await expect(
        service.setTeacherApproval("sub-1", "t-1", ApprovalStatus.approved),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403 если запрос пришёл не от закреплённого преподавателя", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue({
        id: "sub-1",
        dialogId: "dlg-1",
        dialog: { teacherId: "real-teacher" },
      });
      const { service } = makeService(prisma);

      await expect(
        service.setTeacherApproval("sub-1", "imposter", ApprovalStatus.approved),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("отказ если status не approved/rejected", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue({
        id: "sub-1",
        dialogId: "dlg-1",
        dialog: { teacherId: "t-1" },
      });
      const { service } = makeService(prisma);

      await expect(
        service.setTeacherApproval("sub-1", "t-1", ApprovalStatus.pending),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("upsert с decidedById=teacherId и event approval_updated", async () => {
      const prisma = makePrismaMock();
      prisma.submission.findUnique.mockResolvedValue({
        id: "sub-1",
        dialogId: "dlg-1",
        dialog: { teacherId: "t-1" },
      });
      prisma.approval.upsert.mockResolvedValue({ id: "a-1" });
      const { service } = makeService(prisma);

      const result = await service.setTeacherApproval(
        "sub-1",
        "t-1",
        ApprovalStatus.rejected,
        "fix it",
      );

      expect(result).toEqual({ id: "a-1" });
      expect(prisma.approval.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { submissionId_type: { submissionId: "sub-1", type: ApprovalType.teacher } },
          create: expect.objectContaining({
            type: ApprovalType.teacher,
            status: ApprovalStatus.rejected,
            decidedById: "t-1",
            comment: "fix it",
          }),
        }),
      );
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "t-1",
          payload: expect.objectContaining({ type: "teacher", status: ApprovalStatus.rejected }),
        }),
      });
    });
  });

  // ─────────────────────────── findCheckBySubmission ───────────────────────────

  describe("findCheckBySubmission", () => {
    it("404 если check не существует", async () => {
      const prisma = makePrismaMock();
      prisma.check.findUnique.mockResolvedValue(null);
      const { service } = makeService(prisma);

      await expect(service.findCheckBySubmission("sub-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("возвращает check с упорядоченными errors", async () => {
      const prisma = makePrismaMock();
      const check = { id: "chk-1", errors: [] };
      prisma.check.findUnique.mockResolvedValue(check);
      const { service } = makeService(prisma);

      const result = await service.findCheckBySubmission("sub-1");

      expect(result).toBe(check);
      expect(prisma.check.findUnique).toHaveBeenCalledWith({
        where: { submissionId: "sub-1" },
        include: { errors: { orderBy: [{ severity: "asc" }, { page: "asc" }] } },
      });
    });
  });
});
