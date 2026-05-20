import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, ArrowRight, FileUp, GitBranch, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { dialogsApi, submissionsApi } from "@/api/endpoints";
import { isStudent, useAuth } from "@/auth/auth-store";
import { DialogConfigEditor } from "@/components/dialog-config-editor";
import { DownloadFileButton } from "@/components/download-file-button";
import { MessagesPanel } from "@/components/messages-panel";
import { ApprovalBadge, CheckStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatFullName } from "@/lib/utils";

export function DialogDetailPage() {
  const { dialogId = "" } = useParams();
  const role = useAuth((s) => s.role);
  const userId = useAuth((s) => s.userId);
  const navigate = useNavigate();

  const dialogQuery = useQuery({
    queryKey: ["dialog", dialogId],
    queryFn: () => dialogsApi.findOne(dialogId),
  });

  const submissionsQuery = useQuery({
    queryKey: ["dialog", dialogId, "submissions"],
    queryFn: () => submissionsApi.list(dialogId),
    // Активный poll если есть submission в pending/processing
    refetchInterval: (q) => {
      const list = q.state.data;
      if (!list) return false;
      const active = list.some(
        (s) => s.check?.status === "pending" || s.check?.status === "processing",
      );
      return active ? 3000 : false;
    },
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <ArrowLeft /> К списку
        </Link>
      </Button>

      {dialogQuery.isLoading || !dialogQuery.data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 w-full bg-primary" />
          <CardHeader className="pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="text-xl">{dialogQuery.data.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    Студент:{" "}
                    <span className="font-medium text-foreground">
                      {formatFullName(dialogQuery.data.student)}
                    </span>
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    Преподаватель:{" "}
                    <span className="font-medium text-foreground">
                      {formatFullName(dialogQuery.data.teacher)}
                    </span>
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {dialogQuery.data.status}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {dialogQuery.data?.config && (
        <DialogConfigEditor
          dialogId={dialogId}
          config={dialogQuery.data.config}
          editable={
            role === "teacher" &&
            dialogQuery.data.teacherId === userId &&
            dialogQuery.data.status === "open"
          }
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GitBranch className="h-4 w-4 text-primary" /> Версии
        </h2>
        {isStudent(role) && <NewSubmissionButton dialogId={dialogId} />}
      </div>

      {submissionsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !submissionsQuery.data?.length ? (
        <p className="text-sm text-muted-foreground">Нет сабмишенов</p>
      ) : (
        <>
          {/* Timeline-стиль: вертикальная линия + точки */}
          <div className="relative space-y-3 pl-6">
            <div className="absolute left-2 top-3 h-[calc(100%-1.5rem)] w-px bg-border" />
            {submissionsQuery.data.map((s, idx) => {
              const ok = s.check?.status === "done" && s.check?.errorCount === 0;
              const fail =
                s.check?.status === "failed" ||
                (s.check?.status === "done" && s.check?.errorCount > 0);
              const dot = ok
                ? "bg-emerald-500"
                : fail
                  ? "bg-rose-500"
                  : "bg-blue-500";
              return (
                <div key={s.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[1.4rem] top-5 h-3 w-3 rounded-full ring-4 ring-background",
                      dot,
                    )}
                  />
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/submissions/${s.id}`)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && navigate(`/submissions/${s.id}`)
                    }
                    className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
                  >
                    <CardContent className="flex flex-wrap items-center gap-4 p-4">
                      <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-sm font-semibold text-primary">
                        v{s.version}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.files[0]?.originalName ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {idx === 0 && (
                            <span className="mr-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                              latest
                            </span>
                          )}
                          {format(new Date(s.createdAt), "d MMM yyyy, HH:mm", {
                            locale: ru,
                          })}
                          {s.comment && (
                            <span className="ml-1 italic">— {s.comment}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.check && <CheckStatusBadge status={s.check.status} />}
                        {s.approvals.map((a) => (
                          <ApprovalBadge
                            key={a.type}
                            type={a.type}
                            status={a.status}
                          />
                        ))}
                        {s.files[0] && (
                          <DownloadFileButton
                            fileId={s.files[0].id}
                            fileName={s.files[0].originalName}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          {dialogQuery.data && (
            <MessagesPanel
              dialogId={dialogId}
              counterpart={
                role === "student"
                  ? dialogQuery.data.teacher
                  : dialogQuery.data.student
              }
              counterpartRole={role === "student" ? "teacher" : "student"}
            />
          )}
        </>
      )}
    </div>
  );
}

function NewSubmissionButton({ dialogId }: { dialogId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const add = useMutation({
    mutationFn: () => submissionsApi.add({ dialogId, file: file!, comment }),
    onSuccess: (sub) => {
      queryClient.invalidateQueries({ queryKey: ["dialog", dialogId, "submissions"] });
      queryClient.invalidateQueries({ queryKey: ["dialogs"] });
      toast.success(`Версия v${sub.version} создана, проверка запущена`);
      setOpen(false);
      navigate(`/submissions/${sub.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Не удалось загрузить версию");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <FileUp /> Новая версия
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузить новую версию</DialogTitle>
          <DialogDescription>
            Запустит новый pipeline. Старые версии останутся доступны.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>PDF файл</Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              placeholder="Что изменилось"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button disabled={!file || add.isPending} onClick={() => add.mutate()}>
            {add.isPending && <Loader2 className="animate-spin" />}
            Загрузить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

