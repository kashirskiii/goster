import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import { basename } from "path";

export interface PdfIssue {
  severity: "ERROR" | "WARNING";
  type: string;
  page: number;
  text_preview: string;
  expected: string;
  actual: string;
  message: string;
  bbox: [number, number, number, number];
}

export interface PdfCheckResult {
  validator: string;
  is_valid: boolean;
  error_count: number;
  warning_count: number;
  issues: PdfIssue[];
}

export interface PdfValidationReport {
  document: string;
  page_count: number;
  is_valid: boolean;
  total_errors: number;
  total_warnings: number;
  checks: PdfCheckResult[];
}

@Injectable()
export class PdfAnalysisClient {
  private readonly logger = new Logger(PdfAnalysisClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("PDF_ANALYSIS_URL", "http://localhost:8000");
    this.timeoutMs = Number(config.get("PDF_ANALYSIS_TIMEOUT_MS", 60_000));
  }

  async validate(
    absolutePath: string,
    originalName: string,
    config?: unknown,
  ): Promise<PdfValidationReport> {
    const buffer = await readFile(absolutePath);
    const blob = new Blob([buffer], { type: "application/pdf" });

    const form = new FormData();
    form.append("file", blob, basename(originalName));
    if (config !== undefined && config !== null) {
      form.append("config", JSON.stringify(config));
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/validate`, {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`pdf-analysis-service ${res.status}: ${text || res.statusText}`);
      }

      return (await res.json()) as PdfValidationReport;
    } catch (err) {
      this.logger.error(`validate failed for ${originalName}: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async renderSnippet(
    absolutePath: string,
    originalName: string,
    page: number,
    bbox: [number, number, number, number],
  ): Promise<Buffer> {
    const buffer = await readFile(absolutePath);
    const blob = new Blob([buffer], { type: "application/pdf" });

    const form = new FormData();
    form.append("file", blob, basename(originalName));
    form.append("page", String(page));
    form.append("bbox", JSON.stringify(bbox));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/render-snippet`, {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`pdf-analysis-service ${res.status}: ${text || res.statusText}`);
      }
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
