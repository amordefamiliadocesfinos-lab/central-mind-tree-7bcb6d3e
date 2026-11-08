import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AdminModuleKey } from "@/lib/admin/users.server";
import { ROLLOUT_READY_MODULE_KEYS } from "@/lib/admin/rollout-module-policy";

export type ModuleGrant = { auth_user_id: string; module_key: string };

export const MODULE_LABELS: Record<AdminModuleKey, string> = {
  saude: "Saúde / CCH",
  planejamento: "Planejamento",
  calendario: "Calendário",
  rotina: "Rotina",
  foco: "Foco",
  metas: "Metas",
  "minha-area": "Minha Área",
  assistente: "Assistente IA",
  nucleo: "Núcleo",
  captura: "Captura Central",
  operacoes: "Operações",
  financeiro: "Financeiro",
  crm: "CRM",
  digital: "Digital",
  producao: "Produção",
  academia: "Academia (aprendizado)",
  dashboard: "Dashboard",
  reunioes: "Reuniões",
  rotas: "Rotas",
  oportunidades: "Oportunidades",
  planilhas: "Planilhas",
};
const KEYS = Object.keys(MODULE_LABELS) as AdminModuleKey[];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string; auth_user_id: string } | null;
  current: string[];
  onSave: (authUserId: string, modules: string[]) => Promise<void>;
};

export function UserModuleAccessDialog({ open, onOpenChange, user, current, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(current);
    setError(null);
  }, [open, current]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(user.auth_user_id, selected);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Módulos autorizados — {user?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Os módulos fora da etapa Saúde estão indisponíveis até a homologação
          de permissões na API, banco, Storage e rotas.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {KEYS.map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
              <Checkbox
                disabled={!(ROLLOUT_READY_MODULE_KEYS as readonly string[]).includes(key)}
                checked={selected.includes(key)}
                onCheckedChange={(checked) => setSelected((previous) =>
                  checked ? [...new Set([...previous, key])] : previous.filter((item) => item !== key)
                )}
              />
              {MODULE_LABELS[key]}
              {!(ROLLOUT_READY_MODULE_KEYS as readonly string[]).includes(key) ? " · Em homologação" : ""}
            </label>
          ))}
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Salvando..." : "Salvar permissões"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
