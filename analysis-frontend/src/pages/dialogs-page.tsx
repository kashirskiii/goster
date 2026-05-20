import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, FileStack, Inbox, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { dialogsApi } from "@/api/endpoints";
import type { DialogStatus } from "@/api/types";
import { useAuth, isStudent } from "@/auth/auth-store";
import { ApprovalBadge, CheckStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatFullName } from "@/lib/utils";

const statusAccent: Record<DialogStatus, string> = {
  open: "from-blue-500 to-sky-400",
  approved: "from-emerald-500 to-teal-500",
  rejected: "from-rose-500 to-rose-400",
  closed: "from-slate-400 to-slate-500",
};

const statusLabel: Record<DialogStatus, string> = {
  open: "В работе",
  approved: "Одобрено",
  rejected: "Отклонено",
  closed: "Закрыто",
};

export function DialogsPage() {
  const role = useAuth((s) => s.role);
  const { data: dialogs, isLoading } = useQuery({
    queryKey: ["dialogs"],
    queryFn: dialogsApi.list,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Мои <span className="text-primary">работы</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Каждая работа — отдельный диалог с историей версий и автоматической
            проверкой ГОСТ.
          </p>
        </div>
        {isStudent(role) && (
          <Button asChild size="lg">
            <Link to="/dialogs/new">
              <Plus /> Новый диалог
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : !dialogs?.length ? (
        <Card className="overflow-hidden">
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
              <Inbox className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">Здесь пока пусто</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {isStudent(role)
                ? "Создайте первый диалог с преподавателем — мы автоматически прогоним документ через проверку ГОСТ."
                : "Студенты ещё не отправили работы на проверку."}
            </p>
            {isStudent(role) && (
              <Button asChild className="mt-5">
                <Link to="/dialogs/new">
                  <Sparkles /> Начать
                </Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dialogs.map((d) => {
            const last = d.submissions[0];
            const counterpart = role === "student" ? d.teacher : d.student;
            return (
              <Link key={d.id} to={`/dialogs/${d.id}`} className="group">
                <Card className="relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg">
                  {/* цветной акцент сверху */}
                  <div
                    className={cn(
                      "h-1 w-full bg-gradient-to-r",
                      statusAccent[d.status],
                    )}
                  />
                  <CardHeader className="space-y-1.5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 text-base font-semibold">
                        {d.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-border/60 bg-background/60 backdrop-blur"
                      >
                        {statusLabel[d.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {role === "student" ? "Преподаватель" : "Студент"}:{" "}
                      <span className="font-medium text-foreground">
                        {formatFullName(counterpart)}
                      </span>
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <FileStack className="h-3.5 w-3.5" />
                      <span>
                        Версий: <strong>{d._count.submissions}</strong>
                      </span>
                      {last && (
                        <span className="ml-auto">
                          {formatDistanceToNow(new Date(last.createdAt), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </span>
                      )}
                    </div>
                    {last?.check && (
                      <div className="flex flex-wrap gap-1.5">
                        <CheckStatusBadge status={last.check.status} />
                        {last.approvals.map((a) => (
                          <ApprovalBadge
                            key={a.type}
                            type={a.type}
                            status={a.status}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-end pt-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Открыть <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
