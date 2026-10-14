import { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Sparkles } from 'lucide-react';
import { EligibilityContact, EXCLUSION_LABELS, evaluateRecipients, summarize } from '@/lib/crm/campaignEligibility';
import { useCrmCampaigns } from '@/hooks/useCrmCampaigns';
import { loadPostSalePanelLifecycleInsight } from '@/lib/crm/postSalePanelLifecycle';
import {
  analyzeCrmCampaignAudience,
  CRM_CAMPAIGN_INTELLIGENCE_MAX_CONTACTS,
  sameCampaignAudienceContacts,
  type CrmCampaignAudienceMode,
  type CrmCampaignAudienceResult,
} from '@/lib/crm/campaignIntelligentAudience';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: EligibilityContact[];
  segmentFilters: Record<string, unknown>;
  onCreated?: (campaignId: string) => void;
}

export function CampaignCreateDialog({ open, onOpenChange, contacts, segmentFilters, onCreated }: Props) {
  const { createCampaignFromSegment } = useCrmCampaigns();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [audienceMode, setAudienceMode] = useState<CrmCampaignAudienceMode>('traditional');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CrmCampaignAudienceResult<EligibilityContact> | null>(null);
  const requestRef = useRef(0);
  useEffect(() => {
    requestRef.current += 1;
    setAnalysis(null);
    setAnalyzing(false);
  }, [contacts, audienceMode, open]);

  const analyzeAudience = async (): Promise<CrmCampaignAudienceResult<EligibilityContact> | null> => {
    if (audienceMode === 'traditional') return null;
    const request = ++requestRef.current;
    setAnalyzing(true);
    try {
      const result = await analyzeCrmCampaignAudience(
        contacts,
        audienceMode,
        loadPostSalePanelLifecycleInsight,
      );
      if (request !== requestRef.current) return null;
      setAnalysis(result);
      return result;
    } catch (err) {
      if (request === requestRef.current) {
        setAnalysis(null);
        toast.error(err instanceof Error ? err.message : 'Não foi possível analisar todo o segmento.');
      }
      return null;
    } finally {
      if (request === requestRef.current) setAnalyzing(false);
    }
  };
  const selected = audienceMode === 'traditional' ? contacts : analysis?.matched ?? [];

  const preview = useMemo(() => {
    const evaluated = evaluateRecipients(selected);
    const totals = summarize(evaluated);
    const reasons = new Map<string, number>();
    evaluated.forEach(r => {
      if (r.exclusion_reason) reasons.set(r.exclusion_reason, (reasons.get(r.exclusion_reason) || 0) + 1);
    });
    return { totals, reasons: [...reasons.entries()] };
  }, [selected]);

  const handleSave = async () => {
    if (!name.trim() || !message.trim() || saving || analyzing
      || preview.totals.total_eligible === 0) return;
    if (audienceMode !== 'traditional' && !analysis) {
      toast.message('Analise o segmento completo antes de criar a campanha.');
      return;
    }
    setSaving(true);
    try {
      let contactsToSave = selected;
      let filters = segmentFilters;
      if (audienceMode !== 'traditional') {
        // Reconferência integral antes de gravar; nenhuma seleção parcial ou
        // inteligência desatualizada deve criar campanha silenciosamente.
        const fresh = await analyzeCrmCampaignAudience(
          contacts, audienceMode, loadPostSalePanelLifecycleInsight);
        setAnalysis(fresh);
        if (!sameCampaignAudienceContacts(fresh.matched, analysis?.matched ?? [])) {
          toast.message('Os sinais mudaram desde a análise. Confira o novo público antes de criar.');
          return;
        }
        if (evaluateRecipients(fresh.matched).every(r => r.status !== 'pending')) {
          toast.message('O público confirmado não possui destinatários elegíveis.');
          return;
        }
        contactsToSave = fresh.matched;
        filters = {
          ...segmentFilters,
          crm_lifecycle_criterion: audienceMode,
          crm_lifecycle_engine: 'F3-A_F3-B_F3-H',
          crm_lifecycle_verified_at: fresh.verifiedAt,
          crm_lifecycle_selection_type: 'snapshot_draft',
        };
      }
      const id = await createCampaignFromSegment({
        name: name.trim(),
        message_text: message.trim(),
        media_url: mediaUrl.trim() || null,
        media_type: mediaUrl.trim() ? 'image' : null,
        segment_filters: filters,
        contacts: contactsToSave,
      });
      if (id) {
        setName(''); setMessage(''); setMediaUrl('');
        onOpenChange(false);
        onCreated?.(id);
      }
    } catch {
      toast.error('A conferência do público falhou. Nenhuma nova campanha foi criada.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Criar campanha com este segmento"
      description="Nenhuma mensagem é enviada nesta etapa."
      className="sm:max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { void handleSave(); }}
            disabled={saving || analyzing || !name.trim() || !message.trim()
              || preview.totals.total_eligible === 0 || (audienceMode !== 'traditional' && !analysis)}>
            <Megaphone className="h-4 w-4 mr-2" />
            Criar campanha (rascunho)
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="campaign-audience-mode" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Critério do público
          </Label>
          <select
            id="campaign-audience-mode"
            value={audienceMode}
            onChange={event => setAudienceMode(event.target.value as CrmCampaignAudienceMode)}
            disabled={saving || analyzing}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="traditional">Filtros atuais (tradicional)</option>
            <option value="post_sale">Pós-venda elegível por fatos</option>
            <option value="repurchase_probable">Recompra provável por histórico</option>
          </select>
          {audienceMode !== 'traditional' && (
            <>
              <p className="text-xs text-muted-foreground">
                Análise de até {CRM_CAMPAIGN_INTELLIGENCE_MAX_CONTACTS} contatos por vez,
                sem selecionar amostras. Refine os filtros antes, se necessário.
                Recompra iniciada pelo cliente continua na Inbox.
              </p>
              <Button type="button" variant="outline" size="sm"
                disabled={analyzing || saving}
                onClick={() => { void analyzeAudience(); }}>
                {analyzing ? 'Analisando todos os contatos...' : 'Analisar segmento'}
              </Button>
              {analysis && (
                <p className="text-xs text-muted-foreground">
                  Verificados: {analysis.evaluatedCount} · Com sinal: {analysis.signalCount} ·
                  Com restrição: {analysis.restrictedCount} · Selecionados por fatos: {analysis.matched.length}.
                </p>
              )}
              {!analysis && !analyzing && (
                <p className="text-xs text-muted-foreground">
                  Análise pendente. Nenhum destinatário foi selecionado automaticamente.
                </p>
              )}
            </>
          )}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span>Selecionados</span><strong>{preview.totals.total_selected}</strong>
          </div>
          <div className="flex items-center justify-between text-emerald-600">
            <span>Elegíveis</span><strong>{preview.totals.total_eligible}</strong>
          </div>
          <div className="flex items-center justify-between text-destructive">
            <span>Excluídos</span><strong>{preview.totals.total_excluded}</strong>
          </div>
          {preview.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {preview.reasons.map(([reason, count]) => (
                <Badge key={reason} variant="outline" className="text-[10px]">
                  {EXCLUSION_LABELS[reason as keyof typeof EXCLUSION_LABELS] || reason}: {count}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          A seleção inteligente registra um retrato dos fatos no rascunho. Antes de
          preparar ou enviar posteriormente, reavalie mudanças comerciais e restrições.
          Nenhuma mensagem é enviada nesta etapa.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-name">Nome da campanha</Label>
          <Input id="campaign-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Reativação agosto" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaign-message">Mensagem</Label>
          <Textarea
            id="campaign-message"
            rows={5}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Olá {{primeiro_nome}}, ..."
          />
          <p className="text-[11px] text-muted-foreground">Variáveis: {'{{nome}}'} e {'{{primeiro_nome}}'}.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaign-media">Mídia (URL opcional)</Label>
          <Input id="campaign-media" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
