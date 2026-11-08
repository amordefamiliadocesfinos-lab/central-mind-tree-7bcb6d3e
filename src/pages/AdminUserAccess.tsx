import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Person = { id: string; name: string; email: string | null; is_active: boolean; auth_user_id: string | null };
type Grant = { auth_user_id: string; module_key: string };
type Registry = { users: Person[]; grants: Grant[]; module_keys: string[] };

const LABELS: Record<string, string> = {
  saude: 'Saúde / CCH', planejamento: 'Planejamento', calendario: 'Calendário',
  rotina: 'Rotina', foco: 'Foco', metas: 'Metas', 'minha-area': 'Minha Área',
  assistente: 'Assistente', nucleo: 'Núcleo', captura: 'Captura Central',
  operacoes: 'Operações', financeiro: 'Financeiro', crm: 'CRM',
  digital: 'Digital', producao: 'Produção', academia: 'Academia (aprendizagem)',
  dashboard: 'Dashboard',
};

export default function AdminUserAccess() {
  const { session } = useAuth();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [userId, setUserId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [athleteId, setAthleteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const person = useMemo(() => registry?.users.find((u) => u.id === userId), [registry, userId]);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    if (!session?.access_token) throw new Error('Faça login antes de continuar.');
    const { data, error: functionError } = await supabase.functions.invoke('admin-user-access', {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (functionError) throw new Error('Operação indisponível. Confira a autorização e o backend.');
    if (data?.error) throw new Error(String(data.error));
    return data;
  }, [session?.access_token]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request({ action: 'list' }) as Registry;
      setRegistry(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível acessar a administração.');
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const target = registry?.users.find((u) => u.id === userId);
    setSelected(target?.auth_user_id
      ? registry?.grants.filter((g) => g.auth_user_id === target.auth_user_id).map((g) => g.module_key) ?? []
      : []);
    setAthleteId('');
  }, [registry, userId]);

  const saveGrants = async () => {
    if (!person?.auth_user_id) return;
    setLoading(true);
    try {
      await request({ action: 'grant', auth_user_id: person.auth_user_id, modules: selected });
      toast.success('Permissões atualizadas; valide o isolamento antes de liberar a conta.');
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao salvar permissões'); }
    finally { setLoading(false); }
  };

  const invite = async () => {
    if (!person || person.auth_user_id) return;
    setLoading(true);
    try {
      const athlete = athleteId.trim();
      await request({ action: 'invite', app_user_id: person.id, athlete_id: athlete || null });
      toast.success('Convite solicitado. Configure os acessos e confirme o login após o aceite.');
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao convidar'); }
    finally { setLoading(false); }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <h1 className="text-2xl font-bold">Administração de acessos</h1>
      <p className="text-sm text-muted-foreground">
        Escolha quais módulos cada usuário poderá acessar. A função administrativa só
        pode ser liberada depois da revisão de RLS e do cadastro seguro dos administradores.
      </p>
      {error && <Card><CardContent className="pt-6 text-destructive" role="alert">{error}</CardContent></Card>}
      <Card>
        <CardHeader><CardTitle>Usuário existente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="access-user">Cadastro</Label>
          <select id="access-user" value={userId} onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-md border bg-background p-2" disabled={loading || !registry}>
            <option value="">Selecione um cadastro</option>
            {registry?.users.map((u) => <option key={u.id} value={u.id}>
              {u.name} — {u.email || 'sem e-mail'} {u.auth_user_id ? '(login vinculado)' : '(sem login)'}
            </option>)}
          </select>
          {person && !person.auth_user_id && (
            <section className="space-y-2 rounded-md border p-3">
              <p className="text-sm">O convite usa o e-mail cadastrado; não solicita nem guarda senha.</p>
              <Label htmlFor="athlete">ID do atleta existente (opcional, conferir antes)</Label>
              <Input id="athlete" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}
                placeholder="UUID do perfil Saúde existente" />
              <Button type="button" onClick={invite} disabled={loading || !person.is_active || !person.email}>
                Convidar e vincular login
              </Button>
            </section>
          )}
        </CardContent>
      </Card>
      {person?.auth_user_id && (
        <Card>
          <CardHeader><CardTitle>Módulos autorizados — {person.name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {registry?.module_keys.map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                  <Checkbox checked={selected.includes(key)}
                    onCheckedChange={(checked) => setSelected((prev) =>
                      checked === true ? [...new Set([...prev, key])] : prev.filter((x) => x !== key))} />
                  <span>{LABELS[key] || key}</span>
                </label>
              ))}
            </div>
            <Button onClick={saveGrants} disabled={loading}>Salvar permissões</Button>
            <p className="text-xs text-muted-foreground">
              O registro de permissões não substitui as políticas RLS do banco.
              Nenhuma permissão nova deve ser efetivada sem a proteção do módulo no backend.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
