// Type definitions matching analysis-api OpenAPI / Prisma schema.
// Если меняется backend-схема — синхронизируйте здесь.

export type UserRole = "student" | "teacher";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ── Dialogs ───────────────────────────────────────────────────────────────

export type DialogStatus = "open" | "approved" | "rejected" | "closed";

export interface UserBrief {
  id: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
}

export interface DialogListItem {
  id: string;
  studentId: string;
  teacherId: string;
  title: string;
  status: DialogStatus;
  createdAt: string;
  student: UserBrief;
  teacher: UserBrief;
  submissions: Array<{
    id: string;
    version: number;
    createdAt: string;
    check: SubmissionCheckSummary | null;
    approvals: Array<Pick<SubmissionApproval, "type" | "status">>;
  }>;
  _count: { submissions: number };
}

export interface DialogDetail {
  id: string;
  studentId: string;
  teacherId: string;
  title: string;
  status: DialogStatus;
  createdAt: string;
  student: UserBrief;
  teacher: UserBrief;
  config: GostConfig | null;
  presetId: string | null;
  preset: { id: string; code: string; name: string } | null;
}

// ── GOST presets / config ─────────────────────────────────────────────────

export interface AllowedFontRule {
  name: string;
  size: number;
  color: [number, number, number];
  size_tolerance?: number;
  color_tolerance?: number;
  description?: string;
}

export interface ValidatorFlags {
  page_number: boolean;
  figure_caption: boolean;
  toc: boolean;
  structural_heading: boolean;
  margin: boolean;
  list: boolean;
}

export interface MarginRule {
  left_mm: number;
  right_mm: number;
  top_mm: number;
  bottom_mm: number;
  tolerance_mm: number;
  ignore_top_band_mm: number;
  ignore_bottom_band_mm: number;
}

export interface GostConfig {
  allowed_fonts: AllowedFontRule[];
  ignore_fonts: string[];
  validators?: ValidatorFlags;
  margins?: MarginRule;
  [key: string]: unknown;
}

export const DEFAULT_VALIDATOR_FLAGS: ValidatorFlags = {
  page_number: true,
  figure_caption: true,
  toc: true,
  structural_heading: true,
  margin: true,
  list: true,
};

export const DEFAULT_MARGIN_RULE: MarginRule = {
  left_mm: 30,
  right_mm: 15,
  top_mm: 20,
  bottom_mm: 20,
  tolerance_mm: 2.5,
  ignore_top_band_mm: 15,
  ignore_bottom_band_mm: 15,
};

export const VALIDATOR_TOGGLE_LABELS: Array<{
  key: keyof ValidatorFlags;
  label: string;
  hint: string;
}> = [
  {
    key: "page_number",
    label: "Нумерация страниц",
    hint: "Сквозная нумерация, расположение номера, титульный без номера",
  },
  {
    key: "figure_caption",
    label: "Подписи рисунков",
    hint: "Формат «Рисунок N — …» под рисунком по центру",
  },
  {
    key: "toc",
    label: "Оглавление",
    hint: "Соответствие заголовков и страниц из оглавления документу",
  },
  {
    key: "structural_heading",
    label: "Заголовки разделов",
    hint: "Введение/Заключение/Список источников и нумерация подразделов",
  },
  {
    key: "margin",
    label: "Поля страниц",
    hint: "Левое / правое / верх / низ. По умолчанию 30/15/20/20 мм",
  },
  {
    key: "list",
    label: "Перечисления",
    hint: "Маркер «–», буквы а)б)в) или цифры 1)2)3); ловит «*», латиницу, точки",
  },
];

export interface GostPreset {
  id: string;
  code: string;
  name: string;
  description: string | null;
  config: GostConfig;
}

export interface CreateDialogResponse {
  dialog: {
    id: string;
    studentId: string;
    teacherId: string;
    title: string;
    status: DialogStatus;
    createdAt: string;
  };
  submission: {
    id: string;
    dialogId: string;
    version: number;
    comment: string | null;
    createdAt: string;
  };
  file: {
    id: string;
    originalName: string;
    path: string;
    mimeType: string | null;
    size: number | null;
    createdAt: string;
  };
}

// ── Submissions ───────────────────────────────────────────────────────────

export type CheckStatus = "pending" | "processing" | "done" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalType = "system" | "teacher";
export type ErrorSeverity = "error" | "warning";

export interface SubmissionFile {
  id: string;
  originalName: string;
  path: string;
  mimeType: string | null;
  size: number | null;
}

export interface SubmissionApproval {
  id: string;
  submissionId: string;
  type: ApprovalType;
  status: ApprovalStatus;
  decidedById: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionCheckSummary {
  status: CheckStatus;
  errorCount: number;
  warningCount: number;
}

export interface Submission {
  id: string;
  dialogId: string;
  version: number;
  comment: string | null;
  createdAt: string;
  files: SubmissionFile[];
  check: SubmissionCheckSummary | null;
  approvals: SubmissionApproval[];
}

// ── Messages ──────────────────────────────────────────────────────────────

export type MessageAuthorType = "student" | "teacher" | "system";

export interface Message {
  id: string;
  dialogId: string;
  authorId: string | null;
  authorType: MessageAuthorType;
  content: string;
  createdAt: string;
  author: {
    id: string;
    email: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
  } | null;
}

// ── Checks ────────────────────────────────────────────────────────────────

export interface CheckError {
  id: string;
  validator: string;
  code: string;
  severity: ErrorSeverity;
  page: number | null;
  textPreview: string | null;
  expected: string | null;
  actual: string | null;
  message: string;
  bbox: unknown;
}

export interface Check {
  id: string;
  submissionId: string;
  status: CheckStatus;
  pageCount: number | null;
  errorCount: number;
  warningCount: number;
  failureReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  errors: CheckError[];
}
