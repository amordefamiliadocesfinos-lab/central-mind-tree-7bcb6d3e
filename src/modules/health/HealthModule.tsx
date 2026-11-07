import { Navigate, Route, Routes } from "react-router-dom";
import { HealthShell } from "./ui/HealthShell";
import { FoundationPage } from "./ui/FoundationPage";
import { HealthAccessGuard } from "./ui/HealthAccessGuard";
import { HealthProfilePage } from "./pages/HealthProfilePage";
import { HealthLibraryPage } from "./pages/HealthLibraryPage";
import { HealthProgramPage } from "./pages/HealthProgramPage";
import { HealthWorkoutPage } from "./pages/HealthWorkoutPage";

export default function HealthModule() {
  return (
    <HealthAccessGuard>
      <Routes>
      <Route element={<HealthShell />}>
        <Route index element={<Navigate to="hoje" replace />} />
        <Route
          path="hoje"
          element={
            <FoundationPage
              title="Hoje"
              description="Centro diário de treino, alimentação, recuperação e evolução."
            />
          }
        />
        <Route path="treino" element={<HealthWorkoutPage />} />
        <Route path="treino/programa" element={<HealthProgramPage />} />
        <Route
          path="alimentacao"
          element={
            <FoundationPage
              title="Alimentação"
              description="Plano, consumo, aderência e resposta nutricional."
            />
          }
        />
        <Route
          path="evolucao"
          element={
            <FoundationPage
              title="Evolução"
              description="Peso, medidas, fotos comparáveis e linha do tempo corporal."
            />
          }
        />
        <Route path="perfil" element={<HealthProfilePage />} />
        <Route
          path="recuperacao"
          element={
            <FoundationPage
              title="Recuperação"
              description="Sinais de recuperação, segurança e prontidão."
            />
          }
        />
        <Route path="biblioteca" element={<HealthLibraryPage />} />
        <Route path="*" element={<Navigate to="/saude/hoje" replace />} />
      </Route>
      </Routes>
    </HealthAccessGuard>
  );
}
