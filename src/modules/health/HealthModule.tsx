import { Navigate, Route, Routes } from "react-router-dom";
import { HealthShell } from "./ui/HealthShell";
import { FoundationPage } from "./ui/FoundationPage";

export default function HealthModule() {
  return (
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
        <Route
          path="treino"
          element={
            <FoundationPage
              title="Treino"
              description="Execução mobile-first e histórico do motor de treinamento."
            />
          }
        />
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
        <Route
          path="perfil"
          element={
            <FoundationPage
              title="Perfil"
              description="Objetivos, preferências e identidade do atleta."
            />
          }
        />
        <Route
          path="recuperacao"
          element={
            <FoundationPage
              title="Recuperação"
              description="Sinais de recuperação, segurança e prontidão."
            />
          }
        />
        <Route
          path="biblioteca"
          element={
            <FoundationPage
              title="Biblioteca"
              description="Exercícios, referências e mídia autorizada."
            />
          }
        />
        <Route path="*" element={<Navigate to="/saude/hoje" replace />} />
      </Route>
    </Routes>
  );
}
