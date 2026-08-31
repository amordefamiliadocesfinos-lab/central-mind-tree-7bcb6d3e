import { useMemo, useState } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Megaphone } from 'lucide-react';
import { EligibilityContact, EXCLUSION_LABELS, evaluateRecipients, summarize } from '@/lib/crm/campaignEligibility';
import { useCrmCampaigns } from '@/hooks/useCrmCampaigns';

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

  const preview = useMemo(() => {
    const evaluated = evaluateRecipients(contacts);
    const totals = summarize(evaluated);
    const reasons = new Map<string, number>();
    evaluated.forEach(r => {
      if (r.exclusion_reason) reasons.set(r.exclusion_reason, (reasons.get(r.exclusion_reason) || 0) + 1);
    });
    return { totals, reasons: [...reasons.entries()] };
  }, [contacts]);

  const handleSave = async () => {
    if (!name.trim() || !message.trim()) return;
    setSaving(true);
    const id = await createCampaignFromSegment({
      name: name.trim(),
      message_text: message.trim(),
      media_url: mediaUrl.trim() || null,
      media_type: mediaUrl.trim() ? 'image' : null,
      segment_filters: segmentFilters,
      contacts,
    });
    setSaving(false);
    if (id) {
      setName(''); setMessage(''); setMediaUrl('');
      onOpenChange(false);
      onCreated?.(id);
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
          <Button onClick={handleSave} disabled={saving || !name.trim() || !message.trim()}>
            <Megaphone className="h-4 w-4 mr-2" />
            Criar campanha (rascunho)
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
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
