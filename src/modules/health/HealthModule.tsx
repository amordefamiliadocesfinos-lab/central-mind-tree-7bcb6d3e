import { Navigate, Route, Routes } from "react-router-dom";
import { HealthShell } from "./ui/HealthShell";
import { HealthAccessGuard } from "./ui/HealthAccessGuard";
import { HealthProfilePage } from "./pages/HealthProfilePage";
import { HealthLibraryPage } from "./pages/HealthLibraryPage";
import { HealthProgramPage } from "./pages/HealthProgramPage";
import { HealthWorkoutPage } from "./pages/HealthWorkoutPage";
import { HealthNutritionPage } from "./pages/HealthNutritionPage";
import { HealthBodyPage } from "./pages/HealthBodyPage";
import { HealthRecoveryPage } from "./pages/HealthRecoveryPage";
import { HealthExamsPage } from "./pages/HealthExamsPage";
import { HealthDashboardPage } from "./pages/HealthDashboardPage";
import { HealthLongitudinalReviewPage } from "./pages/HealthLongitudinalReviewPage";
import { HealthReplanningPage } from "./pages/HealthReplanningPage";
import { HealthReportsPage } from "./pages/HealthReportsPage";
import { HealthRoutinePage } from "./pages/HealthRoutinePage";
import { HealthAnalyticsPage } from "./pages/HealthAnalyticsPage";
import { HealthHistoricalWorkoutRepairPage } from "./pages/HealthHistoricalWorkoutRepairPage";

export default function HealthModule() {
  return (
    <HealthAccessGuard>
      <Routes>
      <Route element={<HealthShell />}>
        <Route index element={<Navigate to="hoje" replace />} />
        <Route path="hoje" element={<HealthDashboardPage />} />
        <Route path="treino" element={<HealthWorkoutPage />} />
        <Route path="treino/programa" element={<HealthProgramPage />} />
        <Route path="treino/reparo-historico-202611" element={<HealthHistoricalWorkoutRepairPage />} />
        <Route path="alimentacao" element={<HealthNutritionPage />} />
        <Route path="evolucao" element={<HealthBodyPage />} />
        <Route path="recuperacao" element={<HealthRecoveryPage />} />
        <Route path="exames" element={<HealthExamsPage />} />
        <Route path="revisao" element={<HealthLongitudinalReviewPage />} />
        <Route path="replanejamento" element={<HealthReplanningPage />} />
        <Route path="relatorios" element={<HealthReportsPage />} />
        <Route path="rotina" element={<HealthRoutinePage />} />
        <Route path="analytics" element={<HealthAnalyticsPage />} />
        <Route path="perfil" element={<HealthProfilePage />} />
        <Route path="biblioteca" element={<HealthLibraryPage />} />
        <Route path="*" element={<Navigate to="/saude/hoje" replace />} />
      </Route>
      </Routes>
    </HealthAccessGuard>
  );
}
