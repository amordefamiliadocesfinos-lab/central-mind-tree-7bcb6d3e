import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  G055_ACCOUNTS, G055_PILOT, G055_ROWS, G055_SOURCE,
  classifyExisting, decisionPayload, verifyMappings, verifyProjection,
  type CanonicalSkuRow, type CoreMapping, type CurrentSkuState,
} from '@/lib/sku/sellerSkuG055';

// The RPC enforces auth.uid()+ADMINISTRADOR itself. Never use service_role, SQL
// console, set_config, token extraction, bypasses, or direct table inserts here.
const db = supabase as any;
type Outcome = 'created' | 'already';
const PILOT = G055_ROWS.find(row => row.mapping_id === G055_PILOT)!;
const BATCH_SIZE = 40;

async function requireAdmin(authId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== authId) {
    throw new Error('Sessão de administrador não validada. Faça login novamente.');
  }
}

async function checkMappings(rows: CanonicalSkuRow[]) {
  const found: CoreMapping[] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { data, error } = await db.from('marketplace_product_mappings')
      .select('id,marketplace,channel_account_id,external_item_id,external_model_id')
      .in('id', rows.slice(i, i + BATCH_SIZE).map(x => x.mapping_id));
    if (error) throw error;
    found.push(...(data ?? []));
  }
  verifyMappings(rows, found);
}

async function readStates(): Promise<Map<string, CurrentSkuState>> {
  const found: CurrentSkuState[] = [];
  for (let i = 0; i < G055_ROWS.length; i += BATCH_SIZE) {
    const { data, error } = await db.from('marketplace_seller_sku_state')
      .select('mapping_id,canonical_sku,reconciliation_status,observation_kind,revision')
      .in('mapping_id', G055_ROWS.slice(i, i + BATCH_SIZE).map(r => r.mapping_id));
    if (error) throw error;
    found.push(...(data ?? []));
  }
  if (new Set(found.map(s => s.mapping_id)).size !== found.length)
    throw new Error('Estados comerciais duplicados no Core');
  const indexed = new Map(found.map(s => [s.mapping_id, s]));
  for (const row of G055_ROWS) classifyExisting(row, indexed.get(row.mapping_id) ?? null);
  return indexed;
}

async function singleState(mappingId: string): Promise<CurrentSkuState | null> {
  const { data, error } = await db.from('marketplace_seller_sku_state')
    .select('mapping_id,canonical_sku,reconciliation_status,observation_kind,revision')
    .eq('mapping_id', mappingId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function verifyWrittenEvent(
  row: CanonicalSkuRow, eventId: string, authId: string,
): Promise<boolean> {
  const { data: event, error: evtError } = await db.from('marketplace_seller_sku_events')
    .select('id,mapping_id,revision,event_kind,actor_auth_user_id')
    .eq('id', eventId).maybeSingle();
  if (evtError) throw evtError;
  if (!event) return false;
  const state = await singleState(row.mapping_id);
  const payload = decisionPayload(row);
  if (event.mapping_id !== row.mapping_id || event.revision !== 1
      || event.actor_auth_user_id !== authId || event.event_kind !== payload.event_kind
      || !state || state.revision !== 1 || state.canonical_sku !== row.canonical_sku
      || state.reconciliation_status !== row.reconciliation_status
      || state.observation_kind !== 'UNKNOWN') {
    throw new Error('Contraprova da gravação inconsistente: ' + row.mapping_id);
  }
  return true;
}

async function recordOne(row: CanonicalSkuRow, authId: string): Promise<Outcome> {
  // Recheck this exact mapping immediately before each write.
  await requireAdmin(authId);
  await checkMappings([row]);
  const before = await singleState(row.mapping_id);
  if (classifyExisting(row, before) === 'EXISTENTE') return 'already';

  // A new UUID per requested event; no retry on uncertain network failure.
  const eventId = crypto.randomUUID();
  const { data, error } = await db.rpc('record_marketplace_seller_sku_state', {
    p_event_id: eventId,
    p_mapping_id: row.mapping_id,
    p_expected_revision: 0,
    p_payload: decisionPayload(row),
  });
  if (error) {
    // A response can be lost after COMMIT; check this exact event before reporting.
    if (await verifyWrittenEvent(row, eventId, authId)) return 'created';
    throw new Error('RPC rejeitou a decisão ' + row.mapping_id + ': ' + error.message);
  }
  if (data?.mapping_id !== row.mapping_id || data?.revision !== 1) {
    throw new Error('RPC retornou identificação/revisão inesperada para ' + row.mapping_id);
  }
  if (!(await verifyWrittenEvent(row, eventId, authId))) {
    throw new Error('Evento não comprovado após RPC: ' + row.mapping_id);
  }
  return 'created';
}

export default function SellerSkuAdminG055() {
  const { user, appUser, profileLoading } = useAuth();
  const admin = !!user && !!appUser?.is_active
    && appUser.auth_user_id === user.id
    && (appUser.role ?? '').trim().toUpperCase() === 'ADMINISTRADOR';

  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [pilotConfirmed, setPilotConfirmed] = useState(false);
  const [states, setStates] = useState<Map<string, CurrentSkuState>>(new Map());
  const [account, setAccount] = useState<string>('SHOPEE CELIVIO');
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState('Execute a conferência de 168/168 mappings antes de gravar.');
  const [progress, setProgress] = useState({ created: 0, already: 0, processed: 0, total: 0 });

  const counts = useMemo(() => ({
    done: G055_ROWS.filter(r => states.has(r.mapping_id)).length,
    planned: G055_ROWS.filter(r => r.reconciliation_status === 'PLANEJADO').length,
    blocked: G055_ROWS.filter(r => r.reconciliation_status === 'BLOQUEADO_LOCAL').length,
  }), [states]);

  async function preflight(): Promise<Map<string, CurrentSkuState>> {
    if (!admin || !user) throw new Error('ADMINISTRADOR autenticado obrigatório');
    await requireAdmin(user.id);
    verifyProjection();
    await checkMappings(G055_ROWS);
    const fresh = await readStates();
    setStates(fresh);
    setPilotConfirmed(fresh.has(G055_PILOT));
    setReady(true);
    setNotice('Contraprova 168/168 OK: Core alinhado à matriz. Registro permitido somente pela RPC oficial.');
    return fresh;
  }

  async function run(action: () => Promise<void>) {
    if (busy || !admin) return;
    setBusy(true);
    setNotice('Validando a sessão e o Core...');
    try { await action(); }
    catch (cause) {
      setReady(false);
      setChecked(false);
      setNotice('STOP — ' + (cause instanceof Error ? cause.message : String(cause)));
    } finally { setBusy(false); }
  }

  const doPreflight = () => void run(async () => { await preflight(); });

  const doPilot = () => void run(async () => {
    if (!ready || !user) throw new Error('Execute primeiro a conferência');
    await preflight();
    const result = await recordOne(PILOT, user.id);
    const fresh = await readStates();
    if (!fresh.has(G055_PILOT)) throw new Error('Piloto sem estado comprovado');
    setStates(fresh);
    setPilotConfirmed(true);
    setNotice('Piloto Celivio confirmado: ' + (result === 'created' ? 'estado e evento gravados.' : 'já registrado; sem duplicação.'));
  });

  const doAccount = () => void run(async () => {
    if (!ready || !pilotConfirmed || !user) throw new Error('Piloto e conferência obrigatórios');
    if (!checked) throw new Error('Confirme a preservação da Shopee e das exceções');
    const selected = G055_ROWS.filter(row => row.account === account && row.mapping_id !== G055_PILOT);
    const shouldProceed = window.confirm(
      'G05.5 — Registrar decisões no Core para ' + account + '?\n' +
      'Não publica ou altera nenhum Seller SKU Shopee.\n' +
      'As exceções serão registradas como BLOQUEADO_LOCAL.'
    );
    if (!shouldProceed) { setNotice('Lote cancelado, sem escrita adicional.'); return; }
    const before = await preflight();
    if (!before.has(G055_PILOT)) throw new Error('Piloto não gravado');
    let created = 0, already = 0;
    setProgress({ created, already, processed: 0, total: selected.length });
    for (let i = 0; i < selected.length; i++) {
      const result = await recordOne(selected[i], user.id);
      if (result === 'created') created++; else already++;
      setProgress({ created, already, processed: i + 1, total: selected.length });
      setNotice('Registrando ' + account + ': ' + (i + 1) + '/' + selected.length);
    }
    const fresh = await readStates();
    setStates(fresh);
    setChecked(false);
    setNotice('Conta concluída: ' + account + ' — ' + created + ' novos, ' + already + ' existentes. Estado total no Core: ' + fresh.size + '/168.');
  });

  if (profileLoading) return <main className="p-8"><Loader2 className="animate-spin" aria-label="Verificando perfil" /></main>;
  if (!admin) return (
    <main className="mx-auto max-w-xl p-8 pt-20" role="alert">
      <Card><CardContent className="space-y-2 py-6">
        <ShieldCheck className="h-6 w-6" />
        <p className="font-semibold">Acesso restrito ao Administrador autenticado.</p>
        <p className="text-sm text-muted-foreground">O servidor também valida identidade e autorização em cada escrita.</p>
        <Link to="/operacoes" className="text-sm underline">Voltar para Operações</Link>
      </CardContent></Card>
    </main>
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-24 pt-16 md:pt-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><ClipboardCheck className="h-6 w-6" />Registro de Seller SKUs — G05.5</h1>
          <p className="mt-1 text-sm text-muted-foreground">Matriz canônica → Core. Sem escrita na Shopee, sem Hub, sem mudar mappings ou estoque.</p>
        </div>
        <Badge variant="outline">Somente Administrador</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card><CardContent className="py-4"><strong className="text-xl">168</strong><p className="text-xs text-muted-foreground">Mappings oficiais</p></CardContent></Card>
        <Card><CardContent className="py-4"><strong className="text-xl">{counts.done}</strong><p className="text-xs text-muted-foreground">Estados existentes no Core</p></CardContent></Card>
        <Card><CardContent className="py-4"><strong className="text-xl">{counts.planned}</strong><p className="text-xs text-muted-foreground">Sem ressalva física</p></CardContent></Card>
        <Card><CardContent className="py-4"><strong className="text-xl">{counts.blocked}</strong><p className="text-xs text-muted-foreground">Exceções em quarentena</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">1. Conferência obrigatória</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Compara os 168 pares de conta, Item ID, Model ID e Mapping ID com o Core, antes de habilitar qualquer gravação.</p>
          <Button onClick={doPreflight} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Conferir 168 mappings</Button>
          {ready && <span className="ml-2 text-sm text-green-700"><CheckCircle2 className="mr-1 inline h-4 w-4" />Conferência aprovada</span>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">2. Piloto Celivio/Neto</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Item <code>23094148715</code> · Model <code>129843489972</code> · SKU <strong>AF-TRF30-KT-030-BRG</strong></p>
          <p className="text-muted-foreground">Somente decisão canônica, com observação UNKNOWN e evento auditável. Não publica Seller SKU.</p>
          <Button disabled={busy || !ready || pilotConfirmed} onClick={doPilot}>
            {pilotConfirmed ? 'Piloto comprovado' : 'Registrar e conferir piloto'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">3. Registro por conta (lotes controlados)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={account} onValueChange={setAccount} disabled={busy}>
            <SelectTrigger aria-label="Conta Shopee" className="w-full sm:max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{G055_ACCOUNTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Cada conta possui 42 mappings: 36 sem ressalva e 6 bloqueados. Registros existentes são preservados, sem regravação.</p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} disabled={busy || !pilotConfirmed} />
            <span>Confirmo que esta operação registra apenas decisões no Core, mantém os 24 casos BLOQUEADO_LOCAL e não altera os códigos históricos VIV- na Shopee.</span>
          </label>
          <Button disabled={busy || !ready || !pilotConfirmed || !checked} onClick={doAccount}>
            Registrar pendentes de {account.replace('SHOPEE ', '')}
          </Button>
          {progress.total > 0 && <p className="text-sm">Lote: {progress.processed}/{progress.total} · novos: {progress.created} · existentes: {progress.already}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 py-4 text-sm" aria-live="polite" role="status">
          <p className="flex items-center gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}{notice}</p>
          <p className="text-muted-foreground">Fonte congelada: {G055_SOURCE}. Observações live Shopee permanecem desconhecidas até evidência recente.</p>
        </CardContent>
      </Card>
    </main>
  );
}
