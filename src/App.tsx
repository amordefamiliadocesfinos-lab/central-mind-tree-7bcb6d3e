import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCrmRouteBlockReason } from "@/lib/crm/crmRouteNavigationGuards";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccessDatabase } from "@/lib/admin/module-grants.types";
import { scopedRouteAllowed } from "@/lib/admin/scoped-route-policy";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import ProductionOperator from "./pages/ProductionOperator";
import ProductionTeamAdmin from "./pages/ProductionTeamAdmin";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { GlobalFooterBar } from "@/components/GlobalFooterBar";
import { OperationalContextTracker } from "@/components/OperationalContextTracker";
import { LightboxProvider, LightboxRoot } from "@/components/lightbox";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { LinesModeProvider } from "@/contexts/LinesModeContext";
import { StockCheckWizard } from "@/components/stock-check";
import { SwipeNavigationWrapper } from "@/components/SwipeNavigationWrapper";
import { AnimatePresence, motion, Variants } from "framer-motion";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import TaskEdit from "./pages/TaskEdit";
import Foco from "./pages/Foco";
import Planejamento from "./pages/Planejamento";
import Calendario from "./pages/Calendario";
import Rotina from "./pages/Rotina";
import Operacoes from "./pages/Operacoes";
import Digital from "./pages/Digital";
import Planilhas from "./pages/Planilhas";
import Reunioes from "./pages/Reunioes";
import ReuniaoDetalhe from "./pages/ReuniaoDetalhe";
import MinhaArea from "./pages/MinhaArea";
import Financeiro from "./pages/Financeiro";
import Assistente from "./pages/Assistente";
import Contatos from "./pages/Contatos";
import ContatosInbox from "./pages/ContatosInbox";
import TarefasAgendadas from "./pages/TarefasAgendadas";
import Rotas from "./pages/Rotas";
import Academia from "./pages/Academia";
import Metas from "./pages/Metas";
import Oportunidades from "./pages/Oportunidades";
import Nucleo from "./pages/Nucleo";
import CapturaCentral from "./pages/CapturaCentral";
import OAuthConsent from "./pages/OAuthConsent";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import NotFound from "./pages/NotFound";
import HealthModule from "./modules/health/HealthModule";
import AdminUsers from "./pages/AdminUsers";
import { CapturaCentralFAB } from "@/components/CapturaCentralFAB";
import { RoutineAlertOverlay } from "@/components/routine/RoutineAlertOverlay";
import { CustomAlarmsRuntime } from "@/components/routine/CustomAlarmsRuntime";
import { useScheduledTaskPromotion } from "./hooks/useScheduledTaskPromotion";
import { useKeyboardAware } from "./hooks/useKeyboardAware";

const queryClient = new QueryClient();

const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15, ease: "easeIn" } },
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} initial="initial" animate="enter" exit="exit" variants={pageVariants}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/foco" element={<Foco />} />
          <Route path="/planejamento" element={<Planejamento />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/rotina" element={<Rotina />} />
          <Route path="/operacoes" element={<Operacoes />} />
          <Route path="/operacoes/nossa-producao" element={<ProductionTeamAdmin />} />
          <Route path="/digital" element={<Digital />} />
          <Route path="/planilhas" element={<Planilhas />} />
          <Route path="/reunioes" element={<Reunioes />} />
          <Route path="/reunioes/:id" element={<ReuniaoDetalhe />} />
          <Route path="/minha-area" element={<MinhaArea />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/contatos" element={<Contatos />} />
          <Route path="/contatos/inbox" element={<ContatosInbox />} />
          <Route path="/contatos/tarefas" element={<TarefasAgendadas />} />
          <Route path="/rotas" element={<Rotas />} />
          <Route path="/academia" element={<Academia />} />
          <Route path="/saude/*" element={<HealthModule />} />
          <Route path="/admin/usuarios" element={<AdminUsers />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/oportunidades" element={<Oportunidades />} />
          <Route path="/nucleo" element={<Nucleo />} />
          <Route path="/captura" element={<CapturaCentral />} />
          <Route path="/task/:id" element={<TaskEdit />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Navigation API: Chrome e navegadores compatíveis permitem cancelar
 * travessia de histórico no evento "navigate" antes do desmontar da Inbox.
 * Sem essa API, preservamos proteção E-01 (links/unload) e busca global.
 * Não interferir diretamente em popstate: ele não é cancelável.
 */
function CrmBrowserNavigationProtection() {
  useEffect(() => {
    const navigationApi = (window as Window & { navigation?: {
      addEventListener(type: string, listener: EventListener): void;
      removeEventListener(type: string, listener: EventListener): void;
    } }).navigation;
    const onNavigate: EventListener = (event) => {
      if (!event.cancelable) return;
      const reason = getCrmRouteBlockReason();
      if (!reason) return;
      event.preventDefault();
      toast.warning(reason);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!getCrmRouteBlockReason()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onLinkCapture = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.href === window.location.href) return;
      const reason = getCrmRouteBlockReason();
      if (!reason) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toast.warning(reason);
    };
    navigationApi?.addEventListener('navigate', onNavigate);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onLinkCapture, true);
    return () => {
      navigationApi?.removeEventListener('navigate', onNavigate);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onLinkCapture, true);
    };
  }, []);
  return null;
}

function AuthenticatedShell() {
  useScheduledTaskPromotion();
  useKeyboardAware();

  return (
    <>
      <CrmBrowserNavigationProtection />
      <GlobalSearchBar />
      <OperationalContextTracker />
      <SwipeNavigationWrapper>
        <AnimatedRoutes />
      </SwipeNavigationWrapper>
      <GlobalFooterBar />
      <CapturaCentralFAB />
      <StockCheckWizard />
      <RoutineAlertOverlay />
      <CustomAlarmsRuntime />
    </>
  );
}


/**
 * Scoped identities must not mount the enterprise shell: its global widgets
 * issue business-domain queries before the user chooses a screen.
 * Until each other domain has audited RLS, only the Health route is enabled.
 */
function ScopedUserApp() {
  const { user, appUser, signOut } = useAuth();
  const [access, setAccess] = useState<{
    authId: string;
    modules: string[];
    denied: boolean;
  } | null>(null);

  useEffect(() => {
    const authId = user?.id;
    if (!authId || appUser?.access_model !== "scoped") return;
    let alive = true;
    const scoped = supabase as unknown as SupabaseClient<AdminAccessDatabase>;
    scoped.from("app_user_module_grants")
      .select("module_key")
      .eq("auth_user_id", authId)
      .then(({ data, error }) => {
        if (!alive) return;
        setAccess({
          authId,
          modules: error ? [] : (data ?? []).map((row) => row.module_key),
          denied: !!error,
        });
      });
    return () => { alive = false; };
  }, [user?.id, appUser?.access_model]);

  if (!user || !access || access.authId !== user.id) {
    return <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Verificando permissões" />
    </div>;
  }
  if (access.denied || !scopedRouteAllowed("/saude", access.modules)) {
    return <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Acesso não liberado</h1>
      <p className="text-sm text-muted-foreground">
        Seu perfil não possui acesso ativo ao módulo Saúde, ou a consulta de permissões falhou.
        Solicite ao administrador a revisão do cadastro.
      </p>
      <button className="rounded-md border px-4 py-2" onClick={() => void signOut()}>
        Sair
      </button>
    </div>;
  }
  return (
    <>
      <header className="flex items-center justify-between border-b p-3">
        <span className="font-semibold">Painel Central — Saúde</span>
        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => void signOut()}>
          Sair
        </button>
      </header>
      <Routes>
        <Route path="/saude/*" element={<HealthModule />} />
        <Route path="*" element={<Navigate to="/saude" replace />} />
      </Routes>
    </>
  );
}

function RoleAwareAuthenticatedApp() {
  const { profileLoading, isProductionOperator, appUser } = useAuth();

  if (profileLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando perfil" />
      </div>
    );
  }

  if (!appUser?.is_active) {
    return <div className="mx-auto max-w-lg p-6 text-center" role="alert">
      Conta sem perfil operacional ativo. Solicite acesso ao administrador.
    </div>;
  }

  if (appUser.access_model === "scoped") return <ScopedUserApp />;

  if (isProductionOperator) {
    return (
      <Routes>
        <Route path="/producao-operador" element={<ProductionOperator />} />
        <Route path="*" element={<Navigate to="/producao-operador" replace />} />
      </Routes>
    );
  }

  return <AuthenticatedShell />;
}

function InternalApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <RoleAwareAuthenticatedApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<InternalApp />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UndoRedoProvider>
        <LinesModeProvider>
          <LightboxProvider>
            <Toaster />
            <Sonner />
            <AppContent />
            <LightboxRoot />
          </LightboxProvider>
        </LinesModeProvider>
      </UndoRedoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
