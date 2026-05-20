import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { basename, dirname, extname, join } from "path";

export interface StoredFile {
  relativePath: string;
  safeFilename: string;
}

@Injectable()
export class FileStorage {
  /**
   * Сохраняет файл сабмишена на диск:
   * uploads/dialogs/{dialogId}/submissions/{submissionId}/{filename}
   */
  async saveSubmissionFile(
    dialogId: string,
    submissionId: string,
    file: Express.Multer.File,
  ): Promise<StoredFile> {
    const safeFilename = this.sanitize(file.originalname);
    const relativePath = `uploads/dialogs/${dialogId}/submissions/${submissionId}/${safeFilename}`;
    const absolutePath = join(process.cwd(), relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return { relativePath, safeFilename };
  }

  private sanitize(originalName: string): string {
    const ext = extname(originalName);
    const name = basename(originalName, ext);
    const safe =
      name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 100) || "file";
    return `${safe}${ext}`;
  }
}
