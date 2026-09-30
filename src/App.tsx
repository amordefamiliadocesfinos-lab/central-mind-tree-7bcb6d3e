import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { GlobalFooterBar } from "@/components/GlobalFooterBar";
import { OperationalContextTracker } from "@/components/OperationalContextTracker";
import { LightboxProvider, LightboxRoot } from "@/components/lightbox";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { LinesModeProvider } from "@/contexts/LinesModeContext";
import { StockCheckAlert, StockCheckWizard } from "@/components/stock-check";
import { AssistantPanel } from "@/components/assistant";
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
import { NucleoLauncherButton } from "@/components/NucleoLauncherButton";
import NotFound from "./pages/NotFound";
import { QuickConversationFAB } from "@/components/crm/QuickConversationFAB";
import { CapturaCentralFAB } from "@/components/CapturaCentralFAB";
import { RoutineAlertOverlay } from "@/components/routine/RoutineAlertOverlay";
import { RoutineAlertsToggleButton } from "@/components/routine/RoutineAlertsToggleButton";
import { CustomAlarmsRuntime } from "@/components/routine/CustomAlarmsRuntime";
import { ActiveUserPicker } from "@/components/ActiveUserPicker";
import { useScheduledTaskPromotion } from "./hooks/useScheduledTaskPromotion";
import { useKeyboardAware } from "./hooks/useKeyboardAware";

const queryClient = new QueryClient();

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/foco" element={<Foco />} />
          <Route path="/planejamento" element={<Planejamento />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/rotina" element={<Rotina />} />
          <Route path="/operacoes" element={<Operacoes />} />
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

/** Shell interno — só renderiza para sessões autenticadas. */
function AuthenticatedShell() {
  useScheduledTaskPromotion();
  useKeyboardAware();

  return (
    <>
      {/* Floating dock above footer — avoids overlapping page header buttons */}
      <div className="fixed z-40 right-3 bottom-16 md:bottom-20 md:right-4 flex items-center gap-1 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-full shadow-md px-1.5 py-1">
        <NucleoLauncherButton />
        <ActiveUserPicker />
        <RoutineAlertsToggleButton />
        <AssistantPanel />
      </div>
      <GlobalSearchBar />
      <OperationalContextTracker />
      <SwipeNavigationWrapper>
        <AnimatedRoutes />
      </SwipeNavigationWrapper>
      <GlobalFooterBar />
      <QuickConversationFAB />
      <CapturaCentralFAB />
      {/* <StockCheckAlert /> desativado a pedido do usuário */}
      <StockCheckWizard />
      <RoutineAlertOverlay />
      <CustomAlarmsRuntime />
    </>
  );
}

function InternalApp() {
  return (
    <AuthProvider>
      <Routes>
          {/* Rotas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
          {/* Todo o restante é protegido */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <AuthenticatedShell />
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
