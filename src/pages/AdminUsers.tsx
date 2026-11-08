import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { NewUserDialog } from "@/components/admin/NewUserDialog";
import { UserModuleAccessDialog, type ModuleGrant } from "@/components/admin/UserModuleAccessDialog";
import { getAdminUsersContext, provisionPanelUser, updateAdminUserModules } from "@/lib/admin/users.functions";
import type { ProvisionUserResult } from "@/lib/admin/users.server";

type AppUser = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  access_model: "legacy" | "scoped";
};

type Athlete = {
  id: string;
  display_name: string;
  auth_user_id: string | null;
  status: string;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [moduleGrants, setModuleGrants] = useState<ModuleGrant[]>([]);
  const [modulesForUser, setModulesForUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [lastResult, setLastResult] = useState<ProvisionUserResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const context = await getAdminUsersContext();
      setAppUsers((context.appUsers ?? []) as AppUser[]);
      setAthletes((context.athletes ?? []) as Athlete[]);
      setModuleGrants((context.moduleGrants ?? []) as ModuleGrant[]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Falha ao carregar usuários.";
      if (message.includes("FORBIDDEN")) setForbidden(true);
      else toast({ variant: "destructive", title: "Erro ao carregar usuários", description: message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return appUsers;
    return appUsers.filter((user) =>
      [user.name, user.email ?? "", user.role ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(needle),
    );
  }, [appUsers, query]);

  if (loading) {
    return (
      <div className="flex min-h-[65dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-xl p-4 pt-20">
        <Card className="border-destructive/30">
          <CardContent className="space-y-3 py-6 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Acesso administrativo restrito</p>
            <p className="text-sm text-muted-foreground">Seu usuário não possui a capability de provisionar contas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-24 pt-16 md:pt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-6 w-6" />
            Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie acessos Auth e vincule cadastros existentes sem recriar dados operacionais ou de Saúde.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button
            className="min-h-11"
            onClick={() => {
              setSelectedUser(null);
              setDialogOpen(true);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input
            className="min-h-11"
            placeholder="Buscar por nome, e-mail ou função"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {lastResult ? (
        <Card className={lastResult.status === "success" ? "border-primary/30" : "border-amber-500/40"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado da última operação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><strong>Auth:</strong> {lastResult.auth.message}</div>
            <div><strong>Cadastro:</strong> {lastResult.appUser.message}</div>
            <div><strong>Saúde:</strong> {lastResult.healthAthlete.message}</div>
            <div><strong>Permissões:</strong> {lastResult.moduleGrants.message}</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {filtered.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {user.role ? <Badge variant="secondary">{user.role}</Badge> : null}
                  <Badge variant={user.auth_user_id ? "default" : "outline"}>
                    {user.auth_user_id ? "Login vinculado" : "Sem login"}
                  </Badge>
                  {!user.is_active ? <Badge variant="destructive">Inativo</Badge> : null}
                  {user.auth_user_id ? (
                    <Badge variant="outline">{user.access_model === "scoped" ? "Acesso restrito" : "Modelo legado"}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{user.email || "Sem e-mail"}</p>
              </div>

              <div className="flex items-center gap-2">
                {user.auth_user_id ? (
                  <>
                    <span className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Login vinculado
                    </span>
                    {user.access_model === "scoped" ? (
                      <Button variant="outline" className="min-h-11" onClick={() => setModulesForUser(user)}>
                        Módulos
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Permissões legadas — migração controlada pendente
                      </span>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={!user.email}
                    onClick={() => {
                      setSelectedUser(user);
                      setDialogOpen(true);
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Criar acesso
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <UserModuleAccessDialog
        open={!!modulesForUser}
        onOpenChange={(open) => { if (!open) setModulesForUser(null); }}
        user={modulesForUser?.auth_user_id ? { name: modulesForUser.name, auth_user_id: modulesForUser.auth_user_id } : null}
        current={moduleGrants.filter((grant) => grant.auth_user_id === modulesForUser?.auth_user_id).map((grant) => grant.module_key)}
        onSave={async (authUserId, modules) => {
          await updateAdminUserModules({ data: { authUserId, modules } });
          toast({ title: "Preferências de módulos registradas", description: "A aplicação das restrições depende da homologação de RLS." });
          await load();
        }}
      />
      <NewUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appUsers={appUsers}
        athletes={athletes}
        preselectedAppUser={selectedUser}
        onSubmit={(input) => provisionPanelUser({ data: input })}
        onCompleted={(result) => {
          setLastResult(result);
          toast({
            title: result.status === "success" ? "Acesso processado" : "Acesso criado com pendência",
            description: result.auth.message,
          });
          void load();
        }}
      />
    </main>
  );
}
