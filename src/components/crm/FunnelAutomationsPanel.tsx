import { useState } from 'react';
import { useAutomationRules, AutomationRule } from '@/hooks/useAutomationRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Zap, ArrowRight, Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'novo_lead', label: 'Nova Consulta', color: 'bg-sky-500' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'bg-cyan-500' },
  { key: 'proposta_enviada', label: 'Orçamento Enviado', color: 'bg-amber-500' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-orange-500' },
  { key: 'fechado', label: 'Pedido Realizado', color: 'bg-yellow-500' },
  { key: 'pos_venda', label: 'Pós-Venda', color: 'bg-emerald-500' },
  { key: 'cadencia', label: 'Cadência', color: 'bg-violet-500' },
  { key: 'perdido', label: 'Perdido', color: 'bg-rose-500' },
];

type Draft = {
  name: string;
  stage: string;
  message: string;
};

const blankDraft = (): Draft => ({
  name: '',
  stage: 'novo_lead',
  message: '',
});

const isSignalOnlyAction = (actionType: string) => actionType === 'alert' || actionType === 'notify';

export function FunnelAutomationsPanel({ onClose }: { onClose?: () => void }) {
  const { rules, createRule, deleteRule, toggleRule } = useAutomationRules();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft());

  const funnelRules = rules.filter(r => r.trigger_type === 'funnel_stage_changed');

  const handleCreate = async () => {
    if (!draft.name.trim()) { toast.error('Dê um nome para o alerta'); return; }

    await createRule({
      name: draft.name,
      description: null,
      trigger_type: 'funnel_stage_changed',
      trigger_config: { stage: draft.stage },
      action_type: 'alert',
      action_config: { message: draft.message || draft.name },
      is_active: true,
    });
    toast.success('Alerta criado');
    setDraft(blankDraft());
    setShowForm(false);
  };

  const stageLabel = (key?: string) => STAGES.find(s => s.key === key)?.label || key || '—';
  const stageColor = (key?: string) => STAGES.find(s => s.key === key)?.color || 'bg-muted';

  const describeAction = (r: AutomationRule) => {
    const c: any = r.action_config || {};
    if (r.action_type === 'create_task') {
      return `Legado inativo: criava tarefa "${c.title || 'Ação'}"`;
    }
    if (r.action_type === 'change_funnel_stage') {
      return `Legado inativo: movia para "${stageLabel(c.target_stage)}"`;
    }
    if (r.action_type === 'notify') {
      return `Sinal: ${c.message || r.name}`;
    }
    return `Alerta: ${c.message || r.name}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Automações do Funil</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        As automações do CRM registram sinais e alertas. Elas não criam Próxima Ação, tarefa oficial nem alteram a etapa comercial.
      </p>

      {!showForm && (
        <Badge
          variant="default"
          className="cursor-pointer text-[10px] gap-1"
          onClick={() => { setDraft(blankDraft()); setShowForm(true); }}
        >
          <Plus className="h-2.5 w-2.5" /> Criar alerta
        </Badge>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Nome do alerta</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 text-sm mt-1" placeholder="Ex.: Lead entrou em negociação" />
            </div>

            <div>
              <Label className="text-xs">Quando o lead entrar na etapa</Label>
              <Select value={draft.stage} onValueChange={(v) => setDraft({ ...draft, stage: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-sm">
                      <span className={cn('inline-block h-2 w-2 rounded-full mr-2', s.color)} />{s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium">
                <Bell className="h-3.5 w-3.5" /> Registrar alerta no histórico
              </div>
              <Label className="text-xs">Mensagem do alerta</Label>
              <Input value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} className="h-8 text-xs mt-1" placeholder="Ex.: Atenção, lead avançou no funil" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setDraft(blankDraft()); }}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate}>Salvar alerta</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Regras configuradas ({funnelRules.length})</Label>
        {funnelRules.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
            Nenhum alerta configurado ainda.
          </p>
        ) : (
          funnelRules.map(r => {
            const stage = (r.trigger_config as any)?.stage as string;
            const signalOnly = isSignalOnlyAction(r.action_type);
            return (
              <Card key={r.id} className={cn(!r.is_active && 'opacity-60')}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        {!signalOnly && <Badge variant="outline" className="text-[9px]">Histórico</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                        <Badge variant="secondary" className="gap-1">
                          <span className={cn('h-1.5 w-1.5 rounded-full', stageColor(stage))} />
                          {stageLabel(stage)}
                        </Badge>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{describeAction(r)}</span>
                      </div>
                    </div>
                    <Switch
                      checked={r.is_active}
                      disabled={!signalOnly}
                      onCheckedChange={() => signalOnly && toggleRule(r.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      disabled={!signalOnly}
                      onClick={() => signalOnly && deleteRule(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
