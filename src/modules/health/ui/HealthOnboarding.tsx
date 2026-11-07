import { FormEvent, useMemo, useState } from "react";
import { HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

type HealthOnboardingProps = {
  onCreate: (displayName: string) => Promise<void>;
};

export function HealthOnboarding({ onCreate }: HealthOnboardingProps) {
  const { appUser, user } = useAuth();
  const initialName = useMemo(
    () => appUser?.name?.trim() || user?.user_metadata?.name?.trim() || "",
    [appUser?.name, user?.user_metadata?.name],
  );
  const [displayName, setDisplayName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(displayName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o perfil Saúde.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-3 py-6 sm:px-4">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Ativar Saúde</h1>
            <p className="text-sm text-muted-foreground">Crie seu perfil pessoal para entrar no módulo.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seu perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="health-display-name">Nome de exibição</Label>
                <Input
                  id="health-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  enterKeyHint="done"
                  maxLength={120}
                  disabled={submitting}
                  className="min-h-11"
                />
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Privacidade
                </div>
                Este perfil pertence ao domínio Saúde. Outros usuários não recebem acesso automaticamente.
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={submitting || displayName.trim().length < 2}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar perfil Saúde
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
