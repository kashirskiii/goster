import { BookOpen, LogOut, ScrollText, Settings2 } from "lucide-react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { authApi } from "@/api/endpoints";
import { useAuth } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const navigate = useNavigate();
  const email = useAuth((s) => s.email);
  const role = useAuth((s) => s.role);
  const refreshToken = useAuth((s) => s.refreshToken);
  const clear = useAuth((s) => s.clear);

  async function handleLogout() {
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => undefined);
    }
    clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <ScrollText className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                ГОСТ Review
              </div>
              <div className="text-xs text-muted-foreground">
                Документы под автопроверкой
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <NavLink
              to="/validators"
              className={({ isActive }) =>
                `hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:inline-flex ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <BookOpen className="h-4 w-4" /> Проверки
            </NavLink>
            <NavLink
              to="/presets"
              className={({ isActive }) =>
                `hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:inline-flex ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Settings2 className="h-4 w-4" /> Пресеты
            </NavLink>
            <div className="hidden text-right text-sm leading-tight sm:block">
              <div className="font-medium">{email}</div>
            </div>
            {role && (
              <Badge
                variant="outline"
                className="bg-accent text-accent-foreground border-accent capitalize"
              >
                {role === "student" ? "Студент" : "Преподаватель"}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  );
}
