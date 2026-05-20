import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { dialogsApi, presetsApi } from "@/api/endpoints";
import { isStudent, useAuth } from "@/auth/auth-store";
import { formatFullName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  teacherId: z.string().uuid("Выберите преподавателя"),
  title: z.string().min(2, "Название минимум 2 символа"),
  comment: z.string().optional(),
  presetId: z.string().uuid("Выберите ГОСТ"),
  file: z
    .any()
    .refine((f) => f instanceof File, "PDF файл обязателен")
    .refine((f) => f && f.size > 0, "Файл пустой")
    .refine(
      (f) => f && f.size < 20 * 1024 * 1024,
      "Файл больше 20 МБ — уменьшите размер",
    ),
});
type FormValues = z.infer<typeof schema>;

export function NewDialogPage() {
  const role = useAuth((s) => s.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: dialogsApi.listTeachers,
  });

  const { data: presets, isLoading: presetsLoading } = useQuery({
    queryKey: ["presets"],
    queryFn: presetsApi.list,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { teacherId: "", title: "", comment: "", presetId: "" },
  });

  const create = useMutation({
    mutationFn: dialogsApi.create,
    onSuccess: ({ dialog }) => {
      queryClient.invalidateQueries({ queryKey: ["dialogs"] });
      toast.success("Диалог создан, проверка запущена");
      navigate(`/dialogs/${dialog.id}`);
    },
    onError: () => toast.error("Не удалось создать диалог"),
  });

  if (!isStudent(role)) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/">
          <ArrowLeft /> К списку
        </Link>
      </Button>
      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-primary" />
        <CardHeader>
          <CardTitle className="text-xl">Новый диалог</CardTitle>
          <CardDescription>
            Загрузите первую версию работы (PDF). Автоматическая ГОСТ-проверка
            запустится сразу после создания.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) =>
              create.mutate({
                teacherId: v.teacherId,
                title: v.title,
                comment: v.comment,
                presetId: v.presetId,
                file: v.file as File,
              }),
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Преподаватель</Label>
              <Controller
                name="teacherId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={teachersLoading || !teachers?.length}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          teachersLoading ? "Загрузка..." : "Выберите преподавателя"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {formatFullName(t)} ({t.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.teacherId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.teacherId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Название работы</Label>
              <Input
                id="title"
                placeholder="Курсовая работа по алгоритмам"
                {...form.register("title")}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий (необязательно)</Label>
              <Textarea
                id="comment"
                placeholder="Первая версия"
                {...form.register("comment")}
              />
            </div>

            <div className="space-y-2">
              <Label>ГОСТ-пресет проверок</Label>
              <Controller
                name="presetId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={presetsLoading || !presets?.length}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={presetsLoading ? "Загрузка..." : "Выберите ГОСТ"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {presets?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.watch("presetId") && presets && (
                <p className="text-xs text-muted-foreground">
                  {presets.find((p) => p.id === form.watch("presetId"))?.description}
                </p>
              )}
              {form.formState.errors.presetId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.presetId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">PDF файл</Label>
              <Controller
                name="file"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="file"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                  />
                )}
              />
              {form.formState.errors.file && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.file.message as string}
                </p>
              )}
            </div>

            <Button type="submit" disabled={create.isPending} className="w-full">
              {create.isPending ? <Loader2 className="animate-spin" /> : <FileUp />}
              Создать и запустить проверку
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
