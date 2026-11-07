import { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealthAthlete } from "../hooks/useHealthAthlete";
import { HealthOnboarding } from "./HealthOnboarding";

export function HealthAccessGuard({ children }: { children: ReactNode }) {
  const { athlete, loading, error, refresh, createOwnAthlete } = useHealthAthlete();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando Saúde" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-background px-3 py-6 sm:px-4">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Saúde indisponível
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Não foi possível validar sua autorização no módulo Saúde.</p>
            <Button variant="outline" className="min-h-11 w-full" onClick={() => void refresh()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!athlete) {
    return (
      <HealthOnboarding
        onCreate={async (displayName) => {
          await createOwnAthlete(displayName);
        }}
      />
    );
  }

  return <>{children}</>;
}
