/**
 * FRENTE 3.3 — Fila manual guiada de campanha.
 * Reaproveita o conceito de fila do BulkWhatsAppDispatch (abrir → confirmar → avançar),
 * sem criar segunda arquitetura de envio: aqui o operador envia pelo WhatsApp/celular.
 *
 * NÃO cria return_at, crm_next_action, aguardando_cliente nem Prioridade.
 */
import { useState } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, CheckCircle2, SkipForward, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { openWhatsApp } from '@/lib/whatsapp';
import { verifyCurrentIntelligentCampaignAudience } from '@/lib/crm/campaignIntelligentSafety';
import {
  CrmCampaignRecipient,
  blockRecipientByOptOut,
  markRecipientSent,
  markRecipientSkipped,
  revalidateOptOut,
} from '@/hooks/useCrmCampaigns';

type Recipient = CrmCampaignRecipient & { contact?: { name?: string; commercial_opt_out?: boolean } };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignMessage: string;
  recipients: Recipient[];
  onChanged?: () => void;
}

export function CampaignManualQueue({ open, onOpenChange, campaignId, campaignMessage, recipients, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, 'sent' | 'skipped' | 'blocked'>>({});

  // Destinatários já tratados nesta sessão saem do cursor local; a atualização
  // assíncrona da lista no pai não pode pular o próximo item da fila.
  const queue = recipients.filter(r => r.status === 'pending' && r.delivery_mode === 'manual' && !done[r.id]);
  const current = queue[0];
  const processed = Object.keys(done).length;
  const total = processed + queue.length;
  const progress = total ? Math.round((processed / total) * 100) : 100;

  const handleOpenWhatsApp = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const blocked = await revalidateOptOut([current.contact_id]);
      if (blocked.has(current.contact_id)) {
        await blockRecipientByOptOut(current.id, campaignId);
        setDone(d => ({ ...d, [current.id]: 'blocked' }));
        toast.error('Contato com opt-out comercial — envio bloqueado.');
        onChanged?.();
        return;
      }
      // F5-B: antes de abrir o WhatsApp, confira o critério inteligente atual.
      // Registrar um envio já realizado continua permitido para auditoria.
      await verifyCurrentIntelligentCampaignAudience(campaignId, [current.id]);
      const ok = openWhatsApp(current.phone_normalized, current.rendered_message || campaignMessage);
      if (!ok) toast.error('Não foi possível abrir o WhatsApp.');
      else toast.message('Mensagem preparada. Envio depende da sua confirmação no WhatsApp e nesta fila.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao conferir permissão de contato.');
    } finally {
      setBusy(false);
    }
  };

  const handleSent = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const blocked = await revalidateOptOut([current.contact_id]);
      if (blocked.has(current.contact_id)) {
        await blockRecipientByOptOut(current.id, campaignId);
        setDone(d => ({ ...d, [current.id]: 'blocked' }));
        toast.error('Contato com opt-out comercial — não pode ser marcado como enviado.');
      } else if (await markRecipientSent(current.id, campaignId)) {
        setDone(d => ({ ...d, [current.id]: 'sent' }));
      }
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao confirmar envio manual.');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (await markRecipientSkipped(current.id, campaignId)) {
        setDone(d => ({ ...d, [current.id]: 'skipped' }));
      }
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao pular destinatário.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => { if (!v && !busy) setDone({}); if (!busy) onOpenChange(v); }}
      title="Fila manual guiada"
      description="Envie pelo WhatsApp e confirme o resultado de cada destinatário."
      className="sm:max-w-lg"
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{processed + (current ? 1 : 0)} de {total}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />

        {!current && (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm">
            {total === 0 ? 'Nenhum destinatário manual pendente.' : 'Fila concluída.'}
          </div>
        )}

        {current && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium">{current.contact?.name || current.contact_id}</p>
              <p className="text-xs text-muted-foreground">{current.phone_normalized}</p>
              <Badge variant="outline" className="mt-2 text-[10px]">Manual</Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {current.rendered_message || campaignMessage}
            </div>

            <Button className="w-full" variant="secondary" disabled={busy} onClick={handleOpenWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2" /> Abrir WhatsApp
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={handleSent}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Enviado
              </Button>
              <Button variant="outline" disabled={busy} onClick={handleSkip}>
                <SkipForward className="h-4 w-4 mr-2" /> Pular
              </Button>
            </div>

            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldAlert className="h-3 w-3" /> Opt-out é revalidado antes de cada execução.
            </p>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
