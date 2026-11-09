import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Apple,
  Dumbbell,
  HeartPulse,
  TrendingUp,
  UserRound,
  MoonStar,
  FlaskConical,
  History,
  ListChecks,
  FileText,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { to: "/saude/hoje", label: "Hoje", mobileLabel: "Hoje", icon: Activity },
  { to: "/saude/treino", label: "Treino", mobileLabel: "Treino", icon: Dumbbell },
  { to: "/saude/alimentacao", label: "Alimentação", mobileLabel: "Dieta", icon: Apple },
  { to: "/saude/evolucao", label: "Evolução", mobileLabel: "Evolução", icon: TrendingUp },
  { to: "/saude/recuperacao", label: "Recuperação", mobileLabel: "Recup.", icon: MoonStar },
  { to: "/saude/exames", label: "Exames", mobileLabel: "Exames", icon: FlaskConical },
  { to: "/saude/revisao", label: "Revisão", mobileLabel: "Revisão", icon: History },
  { to: "/saude/replanejamento", label: "Replanejamento", mobileLabel: "Replanej.", icon: ListChecks },
  { to: "/saude/relatorios", label: "Relatórios", mobileLabel: "Relat.", icon: FileText },
  { to: "/saude/rotina", label: "Rotina", mobileLabel: "Rotina", icon: BellRing },
  { to: "/saude/analytics", label: "Analytics", mobileLabel: "Gráficos", icon: TrendingUp },
  { to: "/saude/perfil", label: "Perfil", mobileLabel: "Perfil", icon: UserRound },
] as const;

export function HealthShell() {
  return (
    <div className="min-h-[100dvh] bg-background pb-36 md:pb-20 print:min-h-0 print:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">Saúde</h1>
            <p className="truncate text-xs text-muted-foreground">CCH · desenvolvimento físico integrado</p>
          </div>
        </div>

        <nav
          aria-label="Navegação Saúde"
          className="mx-auto flex max-w-5xl gap-1 overflow-x-auto border-t px-1 sm:px-3"
        >
          {primaryItems.map(({ to, label, mobileLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 min-w-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="w-full truncate text-center sm:hidden">{mobileLabel}</span>
              <span className="hidden w-full truncate text-center sm:block">{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-6 print:max-w-none print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
