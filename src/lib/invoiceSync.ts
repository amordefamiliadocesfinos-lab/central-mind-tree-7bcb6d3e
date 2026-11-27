/**
 * Sincronização automática pós-emissão de Nota Fiscal.
 * Conecta: Pedido → Faturado; não confirma recebimento ou conciliação,
 * CRM → Pedido concluído, Timeline → Nota fiscal emitida.
 */
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceSyncInput {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  accessKey: string | null;
  issueDate: string; // YYYY-MM-DD
  value: number;
  orderId?: string | null;
  contactId?: string | null;
  customerName?: string | null;
}

export interface InvoiceSyncResult {
  orderUpdated: boolean;
  financialConfirmed: number; // legado: emissão fiscal não concilia lançamentos
  contactUpdated: boolean;
  timelineLogged: boolean;
  errors: string[];
}

export async function syncInvoiceIssued(input: InvoiceSyncInput): Promise<InvoiceSyncResult> {
  const result: InvoiceSyncResult = {
    orderUpdated: false,
    financialConfirmed: 0,
    contactUpdated: false,
    timelineLogged: false,
    errors: [],
  };

  const nowIso = new Date().toISOString();

  // 1. PEDIDO → Faturado
  if (input.orderId) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'faturado', updated_at: nowIso })
      .eq('id', input.orderId);
    if (error) result.errors.push(`Pedido: ${error.message}`);
    else result.orderUpdated = true;
  }

  // 2. FINANCEIRO — emissão fiscal não comprova recebimento nem conciliação.
  // financialConfirmed permanece zero para compatibilidade do contrato de retorno.

  // 3. CRM → Pedido concluído (marca contato como cliente convertido)
  if (input.contactId) {
    const { data: contact, error: cErr } = await supabase
      .from('contacts')
      .select('funnel_status, converted_at, customer_since')
      .eq('id', input.contactId)
      .maybeSingle();

    if (cErr) {
      result.errors.push(`CRM (busca): ${cErr.message}`);
    } else if (contact) {
      const updates: Record<string, any> = { updated_at: nowIso };
      // Marca como cliente convertido se ainda não estiver
      if (contact.funnel_status !== 'cliente') {
        updates.funnel_status = 'cliente';
      }
      if (!contact.converted_at) {
        updates.converted_at = nowIso;
      }
      if (!contact.customer_since) {
        updates.customer_since = input.issueDate;
      }
      // Atualiza último contato
      updates.ultimo_contato = input.issueDate;

      if (Object.keys(updates).length > 1) {
        const { error: updErr } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', input.contactId);
        if (updErr) result.errors.push(`CRM: ${updErr.message}`);
        else result.contactUpdated = true;
      }
    }
  }

  // 4. TIMELINE → Nota fiscal emitida (registra no histórico do contato)
  if (input.contactId) {
    const valueBR = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(input.value || 0);
    const description = `🧾 Nota fiscal ${input.invoiceType} nº ${input.invoiceNumber} emitida — ${valueBR}${
      input.accessKey ? ` · Chave: ${input.accessKey.slice(-8)}` : ''
    }`;

    const { error: histErr } = await supabase.from('contact_history').insert({
      contact_id: input.contactId,
      event_type: 'nota_fiscal',
      interaction_type: 'nota_fiscal',
      description,
      interaction_date: nowIso,
    });
    if (histErr) result.errors.push(`Timeline: ${histErr.message}`);
    else result.timelineLogged = true;
  }

  return result;
}

/** Mensagem amigável de feedback para o toast */
export function buildSyncSummary(result: InvoiceSyncResult): string {
  const parts: string[] = [];
  if (result.orderUpdated) parts.push('Pedido → Faturado');
  if (result.financialConfirmed > 0)
    parts.push(`Receita confirmada (${result.financialConfirmed})`);
  if (result.contactUpdated) parts.push('CRM → Cliente');
  if (result.timelineLogged) parts.push('Timeline atualizada');
  return parts.length > 0 ? parts.join(' · ') : 'Sincronização concluída';
}
