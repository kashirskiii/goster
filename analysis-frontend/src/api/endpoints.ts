import { api } from "./client";
import type {
  ApprovalStatus,
  AuthTokens,
  Check,
  CreateDialogResponse,
  DialogDetail,
  DialogListItem,
  GostConfig,
  GostPreset,
  Message,
  Submission,
  SubmissionApproval,
  UserBrief,
} from "./types";

type Decision = Extract<ApprovalStatus, "approved" | "rejected">;

// ── auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthTokens>("/auth/login", { email, password }).then((r) => r.data),
  logout: (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
};

// ── dialogs ───────────────────────────────────────────────────────────────

export const dialogsApi = {
  list: () => api.get<DialogListItem[]>("/dialogs").then((r) => r.data),

  findOne: (id: string) => api.get<DialogDetail>(`/dialogs/${id}`).then((r) => r.data),

  listTeachers: () => api.get<UserBrief[]>("/dialogs/teachers").then((r) => r.data),

  create: (params: {
    teacherId: string;
    title: string;
    comment?: string;
    presetId?: string;
    file: File;
  }) => {
    const fd = new FormData();
    fd.append("teacherId", params.teacherId);
    fd.append("title", params.title);
    if (params.comment) fd.append("comment", params.comment);
    if (params.presetId) fd.append("presetId", params.presetId);
    fd.append("file", params.file);
    return api
      .post<CreateDialogResponse>("/dialogs", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  updateConfig: (dialogId: string, config: GostConfig) =>
    api
      .patch<{ id: string; config: GostConfig }>(`/dialogs/${dialogId}/config`, { config })
      .then((r) => r.data),
};

// ── presets ───────────────────────────────────────────────────────────────

export interface PresetUpsertInput {
  code?: string;
  name?: string;
  description?: string | null;
  config?: GostConfig;
}

export const presetsApi = {
  list: () => api.get<GostPreset[]>("/gost-presets").then((r) => r.data),

  create: (input: PresetUpsertInput) =>
    api.post<GostPreset>("/gost-presets", input).then((r) => r.data),

  update: (id: string, input: PresetUpsertInput) =>
    api.patch<GostPreset>(`/gost-presets/${id}`, input).then((r) => r.data),

  remove: (id: string) =>
    api.delete<{ id: string }>(`/gost-presets/${id}`).then((r) => r.data),
};

// ── messages ──────────────────────────────────────────────────────────────

export const messagesApi = {
  list: (dialogId: string) =>
    api.get<Message[]>(`/dialogs/${dialogId}/messages`).then((r) => r.data),

  send: (params: { dialogId: string; content: string }) =>
    api
      .post<Message>(`/dialogs/${params.dialogId}/messages`, {
        content: params.content,
      })
      .then((r) => r.data),
};

// ── check errors ──────────────────────────────────────────────────────────

export const checkErrorsApi = {
  /**
   * Fetches snippet PNG as blob and returns an object URL.
   * Caller is responsible for revoking the URL via URL.revokeObjectURL.
   */
  async snippetObjectUrl(checkErrorId: string): Promise<string> {
    const res = await api.get<Blob>(`/check-errors/${checkErrorId}/snippet`, {
      responseType: "blob",
    });
    return URL.createObjectURL(res.data);
  },
};

// ── files ─────────────────────────────────────────────────────────────────

export const filesApi = {
  /**
   * Скачивает файл через axios (с auth-заголовком), сохраняет на диск
   * с оригинальным именем. Auth через Bearer-токен — обычный <a download>
   * не работает, поэтому идём через blob → object URL → click.
   */
  async download(fileId: string, originalName: string): Promise<void> {
    const res = await api.get<Blob>(`/files/${fileId}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = originalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

// ── submissions ───────────────────────────────────────────────────────────

export const submissionsApi = {
  list: (dialogId: string) =>
    api.get<Submission[]>(`/dialogs/${dialogId}/submissions`).then((r) => r.data),

  add: (params: { dialogId: string; comment?: string; file: File }) => {
    const fd = new FormData();
    if (params.comment) fd.append("comment", params.comment);
    fd.append("file", params.file);
    return api
      .post<Submission>(`/dialogs/${params.dialogId}/submissions`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  findOne: (id: string) => api.get<Submission>(`/submissions/${id}`).then((r) => r.data),

  getCheck: (id: string) => api.get<Check>(`/submissions/${id}/check`).then((r) => r.data),

  setTeacherApproval: (params: {
    submissionId: string;
    status: Decision;
    comment?: string;
  }) =>
    api
      .post<SubmissionApproval>(`/submissions/${params.submissionId}/approval`, {
        status: params.status,
        comment: params.comment,
      })
      .then((r) => r.data),
};
