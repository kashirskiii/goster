import { Badge } from "@/components/ui/badge";
import type { ApprovalStatus, ApprovalType, CheckStatus } from "@/api/types";
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  Bot,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<
    CheckStatus,
    { label: string; icon: any; className: string }
  > = {
    pending: {
      label: "В очереди",
      icon: Clock,
      className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    processing: {
      label: "Идёт проверка",
      icon: Loader2,
      className: "bg-sky-100 text-sky-800 border-sky-200 [&_svg]:animate-spin",
    },
    done: {
      label: "Проверка пройдена",
      icon: CheckCircle2,
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    failed: {
      label: "Сбой проверки",
      icon: AlertTriangle,
      className: "bg-rose-100 text-rose-800 border-rose-200",
    },
  };
  const it = map[status];
  const Icon = it.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", it.className)}
    >
      <Icon className="h-3 w-3" /> {it.label}
    </Badge>
  );
}

export function ApprovalBadge({
  type,
  status,
}: {
  type: ApprovalType;
  status: ApprovalStatus;
}) {
  const Icon = type === "system" ? Bot : GraduationCap;
  const label = type === "system" ? "Авто" : "Преподаватель";

  const map: Record<ApprovalStatus, string> = {
    pending: "bg-slate-100 text-slate-700 border-slate-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
  };
  const text: Record<ApprovalStatus, string> = {
    pending: "ожидает",
    approved: "одобрено",
    rejected: "отклонено",
  };
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", map[status])}>
      <Icon className="h-3 w-3" />
      {label}: {text[status]}
    </Badge>
  );
}
