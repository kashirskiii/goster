import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ScrollText } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { authApi } from "@/api/endpoints";
import { useAuth } from "@/auth/auth-store";
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

const schema = z.object({
  email: z.string().email("Неверный email"),
  password: z.string().min(1, "Пароль обязателен"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuth((s) => s.setTokens);
  const accessToken = useAuth((s) => s.accessToken);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: (values: FormValues) => authApi.login(values.email, values.password),
    onSuccess: (tokens) => {
      setTokens(tokens);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      toast.error(status === 401 ? "Неверный email или пароль" : "Ошибка входа");
    },
  });

  if (accessToken) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      {/* Декоративные blob'ы — приглушённый сине-голубой */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <Card className="glass relative w-full max-w-md shadow-soft-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <ScrollText className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl text-foreground">ГОСТ Review</CardTitle>
          <CardDescription>Вход для студентов и преподавателей</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) => loginMutation.mutate(v))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="student@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={loginMutation.isPending} className="w-full">
              {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Тестовые учётные записи в README проекта
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
