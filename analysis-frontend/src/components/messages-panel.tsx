import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Bot,
  GraduationCap,
  Loader2,
  MessageSquare,
  Send,
  User,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { messagesApi } from "@/api/endpoints";
import type { Message, UserBrief } from "@/api/types";
import { isTeacher, useAuth } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatFullName } from "@/lib/utils";

interface Props {
  dialogId: string;
  counterpart: UserBrief;
  counterpartRole: "student" | "teacher";
}

export function MessagesPanel({ dialogId, counterpart, counterpartRole }: Props) {
  const role = useAuth((s) => s.role);
  const userId = useAuth((s) => s.userId);
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["dialog", dialogId, "messages"],
    queryFn: () => messagesApi.list(dialogId),
    refetchInterval: 5000,
  });

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messagesQuery.data?.length]);

  const send = useMutation({
    mutationFn: () => messagesApi.send({ dialogId, content: text }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["dialog", dialogId, "messages"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Не удалось отправить");
    },
  });

  const canSend = text.trim().length > 0 && !send.isPending;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-accent/40 py-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" /> Переписка
            {messagesQuery.data && messagesQuery.data.length > 0 && (
              <Badge
                variant="outline"
                className="ml-1 border-primary/20 bg-background/60"
              >
                {messagesQuery.data.length}
              </Badge>
            )}
          </CardTitle>
          <div className="text-right text-xs leading-tight">
            <div className="text-muted-foreground">
              {counterpartRole === "teacher" ? "Преподаватель" : "Студент"}
            </div>
            <div className="font-medium text-foreground">
              {formatFullName(counterpart)}
            </div>
          </div>
        </div>
      </CardHeader>

      <div ref={listRef} className="max-h-[520px] overflow-y-auto px-6 py-5">
        {messagesQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-14 w-2/3 rounded-2xl" />
            <Skeleton className="h-14 w-3/4 rounded-2xl" />
          </div>
        ) : !messagesQuery.data?.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Сообщений пока нет — напишите первым
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messagesQuery.data.map((m, i) => {
              const prev = messagesQuery.data![i - 1];
              const showDay =
                !prev ||
                !isSameDay(new Date(m.createdAt), new Date(prev.createdAt));
              return (
                <Fragment key={m.id}>
                  {showDay && <DaySeparator date={m.createdAt} />}
                  <ChatBubble message={m} mine={m.authorId === userId} />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <CardContent className="space-y-3 border-t border-border/60 bg-muted/30 p-4">
        <Textarea
          placeholder={
            isTeacher(role)
              ? "Текст комментария..."
              : "Напишите сообщение преподавателю..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
              e.preventDefault();
              send.mutate();
            }
          }}
          className="min-h-[88px] resize-none bg-background"
        />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + Enter
            </kbd>{" "}
            — отправить
          </p>
          <Button
            size="sm"
            className="ml-auto"
            disabled={!canSend}
            onClick={() => send.mutate()}
          >
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Отправить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatBubble({ message, mine }: { message: Message; mine: boolean }) {
  const isSystem = message.authorType === "system";
  if (isSystem) {
    const [head, ...rest] = message.content.split("\n");
    const tail = rest.join("\n");
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-xl bg-muted/70 px-3 py-1.5 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2 font-medium text-foreground">
            <Bot className="h-3 w-3 text-muted-foreground" />
            <span>{head}</span>
          </div>
          {tail && (
            <p className="mt-1 whitespace-pre-line italic">{tail}</p>
          )}
          <div className="mt-0.5 text-[10px] leading-none text-muted-foreground">
            {format(new Date(message.createdAt), "HH:mm")}
          </div>
        </div>
      </div>
    );
  }

  const isTeacherMsg = message.authorType === "teacher";
  const Icon = isTeacherMsg ? GraduationCap : User;

  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-soft",
          isTeacherMsg ? "bg-blue-700" : "bg-sky-500",
        )}
        title={message.author ? formatFullName(message.author) : message.authorType}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", mine && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm shadow-soft",
            mine
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm border border-border/60 bg-background",
          )}
        >
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
          <span
            className={cn(
              "mt-0.5 block text-right text-[10px] leading-none",
              mine ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {format(new Date(message.createdAt), "HH:mm")}
          </span>
        </div>
      </div>
    </div>
  );
}

function DaySeparator({ date }: { date: string }) {
  const d = new Date(date);
  const label = isToday(d)
    ? "Сегодня"
    : isYesterday(d)
      ? "Вчера"
      : format(d, "d MMMM yyyy", { locale: ru });
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-muted/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
