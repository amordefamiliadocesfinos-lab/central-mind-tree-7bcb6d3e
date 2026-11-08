import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProvisionUserResult } from "@/lib/admin/users.server";

type AppUserOption = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  auth_user_id: string | null;
};

type AthleteOption = {
  id: string;
  display_name: string;
  auth_user_id: string | null;
  status: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUsers: AppUserOption[];
  athletes: AthleteOption[];
  preselectedAppUser?: AppUserOption | null;
  onSubmit: (input: {
    name: string;
    email: string;
    mode: "invite" | "temporary_password";
    temporaryPassword?: string;
    role?: string | null;
    appUserId?: string | null;
    healthAthleteId?: string | null;
  }) => Promise<ProvisionUserResult>;
  onCompleted: (result: ProvisionUserResult) => void;
};

export function NewUserDialog({
  open,
  onOpenChange,
  appUsers,
  athletes,
  preselectedAppUser,
  onSubmit,
  onCompleted,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [mode, setMode] = useState<"invite" | "temporary_password">("invite");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [appUserId, setAppUserId] = useState<string>("none");
  const [healthAthleteId, setHealthAthleteId] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMode("invite");
    setTemporaryPassword("");

    if (preselectedAppUser) {
      setName(preselectedAppUser.name);
      setEmail(preselectedAppUser.email ?? "");
      setRole(preselectedAppUser.role ?? "");
      setAppUserId(preselectedAppUser.id);

      // Names are not unique identifiers; athlete linkage requires explicit selection.
      setHealthAthleteId("none");
    } else {
      setName("");
      setEmail("");
      setRole("");
      setAppUserId("none");
      setHealthAthleteId("none");
    }
  }, [open, preselectedAppUser, athletes]);

  const selectedAppUser = useMemo(
    () => appUsers.find((user) => user.id === appUserId) ?? null,
    [appUsers, appUserId],
  );

  useEffect(() => {
    if (!selectedAppUser) return;
    setName(selectedAppUser.name);
    setEmail(selectedAppUser.email ?? "");
    setRole(selectedAppUser.role ?? "");
  }, [selectedAppUser]);

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (mode === "temporary_password" && temporaryPassword.length < 8) {
      setError("A senha temporária precisa ter pelo menos 8 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const result = await onSubmit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mode,
        temporaryPassword: mode === "temporary_password" ? temporaryPassword : undefined,
        role: role.trim() || null,
        appUserId: appUserId === "none" ? null : appUserId,
        healthAthleteId: healthAthleteId === "none" ? null : healthAthleteId,
      });
      setTemporaryPassword("");
      onCompleted(result);
      if (result.status === "success") onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o acesso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Novo acesso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Cadastro operacional existente</Label>
            <Select value={appUserId} onValueChange={setAppUserId}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum / criar conforme necessário</SelectItem>
                {appUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}{user.email ? " · " + user.email : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-user-name">Nome</Label>
              <Input id="admin-user-name" className="min-h-11" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-email">E-mail</Label>
              <Input id="admin-user-email" className="min-h-11" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-user-role">Função operacional</Label>
            <Input
              id="admin-user-role"
              className="min-h-11"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Opcional — ex.: Produção, Gestão"
            />
            <p className="text-xs text-muted-foreground">
              Função operacional não concede permissão para administrar usuários.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Perfil Saúde existente</Label>
            <Select value={healthAthleteId} onValueChange={setHealthAthleteId}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum vínculo Saúde</SelectItem>
                {athletes.map((athlete) => (
                  <SelectItem key={athlete.id} value={athlete.id}>
                    {athlete.display_name}{athlete.auth_user_id ? " · já vinculado" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione explicitamente o atleta correto. O vínculo reaproveita o perfil e todo o histórico.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Forma de acesso</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as typeof mode)} className="grid gap-2 sm:grid-cols-2">
              <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="invite" />
                <Mail className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-medium">Convite</span>
                  <span className="block text-xs text-muted-foreground">Recomendado</span>
                </span>
              </Label>
              <Label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="temporary_password" />
                <KeyRound className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-medium">Senha temporária</span>
                  <span className="block text-xs text-muted-foreground">Administrador define agora</span>
                </span>
              </Label>
            </RadioGroup>
          </div>

          {mode === "temporary_password" ? (
            <div className="space-y-2">
              <Label htmlFor="admin-user-password">Senha temporária</Label>
              <Input
                id="admin-user-password"
                className="min-h-11"
                type="password"
                autoComplete="new-password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A senha é enviada somente ao backend Auth durante esta operação e não é persistida no Painel.
              </p>
            </div>
          ) : null}

          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="min-h-11" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "invite" ? "Enviar convite" : "Criar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
