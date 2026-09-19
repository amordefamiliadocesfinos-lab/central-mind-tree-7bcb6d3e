import { supabase } from '@/integrations/supabase/client';

const POST_SALE_RESULTS = new Set([
  'CRM-RES-023',
  'CRM-RES-024',
  'CRM-RES-025',
  'CRM-RES-026',
  'CRM-RES-027',
  'CRM-RES-028',
  'CRM-RES-029',
]);

export interface PostSaleOrderFact {
  id: string;
  deliveryDate: string | null;
  operationalStatus: string | null;
  status: string | null;
}

export interface PostSaleHistoryFact {
  interactionDate: string | null;
  resultCode: string | null;
}

export interface PostSaleEligibilitySignal {
  eligible: boolean;
  orderId: string | null;
  deliveryDate: string | null;
  reason: string;
}

const NONE: PostSaleEligibilitySignal = {
  eligible: false,
  orderId: null,
  deliveryDate: null,
  reason: 'Não há pedido entregue/finalizado com evidência suficiente para abrir pós-venda.',
};

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * F3-A — sinal puro de elegibilidade de pós-venda.
 *
 * Regras conservadoras:
 * - só considera pedido operacionalmente finalizado;
 * - exige `delivery_date` válida e já atingida;
 * - usa apenas o pedido elegível mais recente;
 * - se já houve Resultado canônico de pós-venda após a entrega, não abre novo sinal.
 *
 * Este cálculo não cria tarefa, não envia mensagem e não altera etapa/estado.
 */
export function calculatePostSaleEligibility(
  orders: PostSaleOrderFact[],
  history: PostSaleHistoryFact[],
  now = new Date(),
): PostSaleEligibilitySignal {
  const today = startOfLocalDay(now).getTime();
  const eligibleOrders = orders
    .filter(order => String(order.operationalStatus ?? '').toLowerCase() === 'finalized')
    .filter(order => order.deliveryDate && !Number.isNaN(Date.parse(order.deliveryDate)))
    .filter(order => startOfLocalDay(new Date(order.deliveryDate!)).getTime() <= today)
    .sort((a, b) => Date.parse(b.deliveryDate!) - Date.parse(a.deliveryDate!));

  const latest = eligibleOrders[0];
  if (!latest?.deliveryDate) return NONE;

  const deliveredAt = startOfLocalDay(new Date(latest.deliveryDate)).getTime();
  const hasPostSaleAfterDelivery = history.some(event => {
    if (!event.interactionDate || !POST_SALE_RESULTS.has(event.resultCode ?? '')) return false;
    const occurredAt = Date.parse(event.interactionDate);
    return Number.isFinite(occurredAt) && occurredAt >= deliveredAt;
  });

  if (hasPostSaleAfterDelivery) {
    return {
      eligible: false,
      orderId: latest.id,
      deliveryDate: latest.deliveryDate,
      reason: 'O pedido mais recente já possui Resultado canônico de pós-venda após a entrega.',
    };
  }

  return {
    eligible: true,
    orderId: latest.id,
    deliveryDate: latest.deliveryDate,
    reason: 'Pedido operacionalmente finalizado, com data de entrega atingida e ainda sem Resultado canônico de pós-venda posterior.',
  };
}

/**
 * Carrega somente os fatos necessários para o sinal F3-A.
 * Nenhuma escrita é realizada.
 */
export async function loadPostSaleEligibility(contactId: string, now = new Date()): Promise<PostSaleEligibilitySignal> {
  if (!contactId) return NONE;
  const db = supabase as any;
  const today = now.toISOString().slice(0, 10);

  const { data: orders, error: ordersError } = await db.from('orders')
    .select('id,delivery_date,operational_status,status')
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .eq('operational_status', 'finalized')
    .not('delivery_date', 'is', null)
    .lte('delivery_date', today)
    .order('delivery_date', { ascending: false })
    .limit(10);
  if (ordersError) throw ordersError;

  const { data: history, error: historyError } = await db.from('contact_history')
    .select('interaction_date,event_metadata')
    .eq('contact_id', contactId)
    .order('interaction_date', { ascending: false })
    .limit(100);
  if (historyError) throw historyError;

  return calculatePostSaleEligibility(
    (orders ?? []).map((order: any) => ({
      id: order.id,
      deliveryDate: order.delivery_date ?? null,
      operationalStatus: order.operational_status ?? null,
      status: order.status ?? null,
    })),
    (history ?? []).map((event: any) => ({
      interactionDate: event.interaction_date ?? null,
      resultCode: typeof event.event_metadata?.result_code === 'string' ? event.event_metadata.result_code : null,
    })),
    now,
  );
}
