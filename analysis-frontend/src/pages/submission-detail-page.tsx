import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Check as CheckIcon,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { submissionsApi } from "@/api/endpoints";
import type { Check, Submission } from "@/api/types";
import { isTeacher, useAuth } from "@/auth/auth-store";
import { DownloadFileButton } from "@/components/download-file-button";
import { ErrorSnippetTrigger } from "@/components/error-snippet-dialog";
import { ApprovalBadge, CheckStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorTitle } from "@/lib/check-errors";

export function SubmissionDetailPage() {
  const { submissionId = "" } = useParams();
  const role = useAuth((s) => s.role);

  const submissionQuery = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => submissionsApi.findOne(submissionId),
    refetchInterval: (q) => {
      const status = q.state.data?.check?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });

  const checkQuery = useQuery({
    queryKey: ["submission", submissionId, "check"],
    queryFn: () => submissionsApi.getCheck(submissionId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });

  const submission = submissionQuery.data;
  const check = checkQuery.data;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to={submission ? `/dialogs/${submission.dialogId}` : "/"}>
          <ArrowLeft /> К диалогу
        </Link>
      </Button>

      {!submission ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 w-full bg-primary" />
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-14 items-center justify-center rounded-xl bg-accent font-mono text-base font-semibold text-primary">
                  v{submission.version}
                </div>
                <div>
                  <CardTitle className="text-base">
                    {submission.files[0]?.originalName ?? "—"}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(submission.createdAt), "d MMMM yyyy, HH:mm", {
                      locale: ru,
                    })}
                    {submission.files[0]?.size != null && (
                      <> · {(submission.files[0].size / 1024 / 1024).toFixed(2)} MB</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {check && <CheckStatusBadge status={check.status} />}
                {submission.files[0] && (
                  <DownloadFileButton
                    fileId={submission.files[0].id}
                    fileName={submission.files[0].originalName}
                    label="Скачать PDF"
                  />
                )}
              </div>
            </div>
            {submission.comment && (
              <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm italic text-muted-foreground">
                «{submission.comment}»
              </p>
            )}
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-4 w-4" /> Результат проверки
          </h2>
          {!check ? (
            <Skeleton className="h-48 w-full" />
          ) : check.status === "pending" || check.status === "processing" ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Идёт автоматическая проверка ГОСТ. Страница обновится сама.
                </p>
              </CardContent>
            </Card>
          ) : check.status === "failed" ? (
            <Card>
              <CardContent className="space-y-2 py-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Сбой автоматической проверки</span>
                </div>
                <p className="text-sm text-muted-foreground">{check.failureReason}</p>
              </CardContent>
            </Card>
          ) : (
            <CheckErrorList check={check} />
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Approvals</h2>
          {submission ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                {submission.approvals.map((a) => (
                  <div key={a.id} className="space-y-1">
                    <ApprovalBadge type={a.type} status={a.status} />
                    {a.comment && (
                      <p className="text-xs text-muted-foreground">{a.comment}</p>
                    )}
                  </div>
                ))}
                {isTeacher(role) && (
                  <TeacherApprovalActions submission={submission} />
                )}
              </CardContent>
            </Card>
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherApprovalActions({ submission }: { submission: Submission }) {
  const queryClient = useQueryClient();
  const teacherApproval = submission.approvals.find((a) => a.type === "teacher");

  const decide = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      submissionsApi.setTeacherApproval({ submissionId: submission.id, status }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["submission", submission.id] });
      queryClient.invalidateQueries({
        queryKey: ["dialog", submission.dialogId, "submissions"],
      });
      queryClient.invalidateQueries({ queryKey: ["dialogs"] });
      toast.success(
        status === "approved"
          ? `v${submission.version} одобрена`
          : `v${submission.version} отклонена`,
      );
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Не удалось обновить решение");
    },
  });

  const isApproved = teacherApproval?.status === "approved";
  const isRejected = teacherApproval?.status === "rejected";

  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={decide.isPending || isRejected}
        onClick={() => decide.mutate("rejected")}
        className="border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
      >
        <X /> Отклонить
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={decide.isPending || isApproved}
        onClick={() => decide.mutate("approved")}
        className="border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
      >
        <CheckIcon /> Одобрить
      </Button>
    </div>
  );
}

function CheckErrorList({ check }: { check: Check }) {
  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base">Страниц: {check.pageCount}</CardTitle>
          {check.errorCount > 0 && (
            <Badge variant="destructive">{check.errorCount} ошибок</Badge>
          )}
          {check.warningCount > 0 && (
            <Badge variant="warning">{check.warningCount} предупреждений</Badge>
          )}
          {check.errorCount === 0 && check.warningCount === 0 && (
            <Badge variant="success">Замечаний нет</Badge>
          )}
        </div>
      </CardHeader>
      {check.errors.length > 0 && (
        <CardContent className="space-y-3 pt-0">
          {check.errors.map((e) => (
            <Card
              key={e.id}
              className="overflow-hidden border-border/60 shadow-soft"
            >
              <div className="flex">
                <div
                  className={
                    e.severity === "error"
                      ? "w-1 shrink-0 bg-destructive"
                      : "w-1 shrink-0 bg-amber-400"
                  }
                />
                <div className="flex-1 space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={e.severity === "error" ? "destructive" : "warning"}
                      className="uppercase"
                    >
                      {e.severity}
                    </Badge>
                    <h4 className="text-sm font-semibold">{errorTitle(e.code)}</h4>
                    <div className="ml-auto flex items-center gap-2">
                      {e.page != null && (
                        <span className="text-xs text-muted-foreground">
                          стр. {e.page}
                        </span>
                      )}
                      {e.page != null && (
                        <ErrorSnippetTrigger checkErrorId={e.id} page={e.page} />
                      )}
                    </div>
                  </div>
                  {e.textPreview && (
                    <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Фрагмент
                      </div>
                      <p className="mt-0.5 break-words font-mono text-xs text-foreground">
                        «{e.textPreview}»
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {e.expected && (
                      <div className="rounded-md border border-emerald-200/70 bg-emerald-50/60 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Ожидается
                        </div>
                        <p className="mt-0.5 whitespace-pre-line break-words text-xs text-emerald-900">
                          {e.expected}
                        </p>
                      </div>
                    )}
                    {e.actual && (
                      <div
                        className={
                          e.severity === "error"
                            ? "rounded-md border border-rose-200/70 bg-rose-50/60 px-3 py-2"
                            : "rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2"
                        }
                      >
                        <div
                          className={
                            e.severity === "error"
                              ? "text-[10px] font-semibold uppercase tracking-wide text-rose-700"
                              : "text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                          }
                        >
                          Найдено
                        </div>
                        <p
                          className={
                            e.severity === "error"
                              ? "mt-0.5 break-words text-xs text-rose-900"
                              : "mt-0.5 break-words text-xs text-amber-900"
                          }
                        >
                          {e.actual}
                        </p>
                      </div>
                    )}
                  </div>
                  {!e.textPreview && !e.expected && !e.actual && (
                    <p className="break-words text-sm text-foreground/80">
                      {e.message}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
