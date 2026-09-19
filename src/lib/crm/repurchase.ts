import { supabase } from '@/integrations/supabase/client';
import type { CrmAiContext } from './aiContext';
import { CRM_REACTIVATION_SOURCE } from './reactivation';

export type RepurchaseStatus = 'none' | 'explicit' | 'probable';
export type RepurchaseConfidence = 'low' | 'medium' | 'high';

/** Sugestão comercial somente leitura. Nunca é uma obrigação do CRM. */
export interface RepurchaseSignal {
  status: RepurchaseStatus;
  confidence: RepurchaseConfidence;
  lastPurchaseAt: string | null;
  purchaseCount: number;
  typicalIntervalDays: number | null;
  daysSinceLastPurchase: number | null;
  likelyProducts: string[];
  reason: string;
}

export interface RepurchaseOrder {
  id: string;
  orderDate: string | null;
  status: string | null;
  paymentStatus: string | null;
  productIds: string[];
}

const NONE: Omit<RepurchaseSignal, 'lastPurchaseAt' | 'purchaseCount' | 'typicalIntervalDays' | 'daysSinceLastPurchase' | 'likelyProducts'> = {
  status: 'none', confidence: 'low', reason: 'Não há evidência suficiente para sugerir recompra.',
};

function isPaidOrCompleted(order: Pick<RepurchaseOrder, 'status' | 'paymentStatus'>) {
  const payment = String(order.paymentStatus ?? '').toLowerCase();
  const status = String(order.status ?? '').toLowerCase();
  return ['pago', 'paid', 'concluido', 'concluida', 'completed'].includes(payment)
    || ['concluido', 'concluida', 'completed', 'entregue'].includes(status);
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function concreteRepurchaseIntent(context: CrmAiContext, now: Date) {
  const message = context.messages.at(-1);
  if (!message || message.direction !== 'inbound' || !message.createdAt) return false;
  const ageDays = (now.getTime() - Date.parse(message.createdAt)) / 86400000;
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 14) return false;
  const text = message.content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(quero fazer outro pedido|quero comprar novamente|me manda outro kit|novo pedido|quero pedir de novo|quero comprar de novo)\b/.test(text);
}

function productEvidence(orders: RepurchaseOrder[], liveIds: string[] | undefined) {
  const counts = new Map<string, number>();
  for (const order of orders) for (const productId of order.productIds) {
    counts.set(productId, (counts.get(productId) ?? 0) + 1);
  }
  const repeated = [...counts].filter(([, count]) => count >= 2).map(([id]) => id);
  return [...new Set([...repeated, ...(liveIds ?? [])])];
}

function noneFrom(orders: RepurchaseOrder[], now: Date, reason = NONE.reason): RepurchaseSignal {
  const paid = orders.filter(isPaidOrCompleted).filter(order => order.orderDate && !Number.isNaN(Date.parse(order.orderDate)));
  const lastPurchaseAt = paid.map(order => order.orderDate!).sort().at(-1) ?? null;
  return {
    ...NONE,
    lastPurchaseAt,
    purchaseCount: paid.length,
    typicalIntervalDays: null,
    daysSinceLastPurchase: lastPurchaseAt ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastPurchaseAt)) / 86400000)) : null,
    likelyProducts: [],
    reason,
  };
}

/** Cálculo puro, determinístico e explicável; não cria nenhuma ação operacional. */
export function calculateRepurchaseSignal(
  context: CrmAiContext,
  orders: RepurchaseOrder[],
  now = new Date(),
): RepurchaseSignal {
  if (context.contact.optOut) return noneFrom(orders, now, 'Contato marcado como não deseja contato comercial.');

  const paid = orders
    .filter(isPaidOrCompleted)
    .filter(order => order.orderDate && !Number.isNaN(Date.parse(order.orderDate)))
    .sort((a, b) => Date.parse(a.orderDate!) - Date.parse(b.orderDate!));
  const lastPurchaseAt = paid.at(-1)?.orderDate ?? null;
  const daysSinceLastPurchase = lastPurchaseAt ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastPurchaseAt)) / 86400000)) : null;
  const likelyProducts = productEvidence(paid, context.liveContext?.memory.purchase_pattern?.recurring_product_ids);

  if (concreteRepurchaseIntent(context, now) && paid.length > 0) {
    return {
      status: 'explicit', confidence: 'high', lastPurchaseAt, purchaseCount: paid.length,
      typicalIntervalDays: null, daysSinceLastPurchase, likelyProducts,
      reason: 'Cliente com histórico de compra demonstrou nova intenção concreta de pedido.',
    };
  }

  // Campanha sem resposta não é iniciativa comercial nova. Um Resultado de
  // pós-venda também não cria recompra por si só, mas não pode bloquear para
  // sempre uma oportunidade sustentada independentemente pelo histórico.
  if (context.campaign?.responded === false) {
    return noneFrom(paid, now, 'Envio de campanha sem resposta não é evidência de recompra.');
  }

  // Uma ou duas compras são histórico, não padrão suficiente para sugestão proativa.
  if (paid.length < 3) return noneFrom(paid, now);

  const intervals = paid.slice(1).map((order, index) =>
    (Date.parse(order.orderDate!) - Date.parse(paid[index].orderDate!)) / 86400000,
  ).filter(days => Number.isFinite(days) && days > 0);
  if (intervals.length < 2) return noneFrom(paid, now);

  const typicalIntervalDays = Math.round(median(intervals));
  const spread = Math.max(...intervals) - Math.min(...intervals);
  const consistent = spread <= Math.max(7, typicalIntervalDays * 0.5);
  const due = daysSinceLastPurchase !== null && daysSinceLastPurchase >= typicalIntervalDays * 0.8;
  if (!consistent || !due) return {
    ...noneFrom(paid, now), typicalIntervalDays, likelyProducts: [],
  };

  return {
    status: 'probable', confidence: 'medium', lastPurchaseAt, purchaseCount: paid.length,
    typicalIntervalDays, daysSinceLastPurchase, likelyProducts,
    reason: `Cliente fez ${paid.length} compras com intervalo típico de ${typicalIntervalDays} dias. Última compra há ${daysSinceLastPurchase} dias.`,
  };
}

/** Uma reativação futura já é uma decisão manual do operador; não compete com ela. */
export function hasFutureCrmReactivation(context: CrmAiContext, now = new Date()) {
  return context.tasks.some(task => task.source === CRM_REACTIVATION_SOURCE
    && task.dueAt
    && Date.parse(task.dueAt) > now.getTime());
}

/** Busca somente os fatos de pedido necessários quando o operador abre o Assistente. */
export async function loadRepurchaseOrders(contactId: string): Promise<RepurchaseOrder[]> {
  if (!contactId) return [];
  const db = supabase as any;
  const { data: orders, error } = await db.from('orders')
    .select('id,order_date,status,payment_status')
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .order('order_date', { ascending: false })
    .limit(20);
  if (error) throw error;
  const ids = (orders ?? []).map((order: any) => order.id).filter(Boolean);
  const { data: items, error: itemError } = ids.length
    ? await db.from('order_items').select('order_id,product_id').in('order_id', ids)
    : { data: [], error: null };
  if (itemError) throw itemError;
  const itemsByOrder = new Map<string, string[]>();
  for (const item of items ?? []) {
    if (item.order_id && item.product_id) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item.product_id]);
  }
  return (orders ?? []).map((order: any) => ({
    id: order.id,
    orderDate: order.order_date ?? null,
    status: order.status ?? null,
    paymentStatus: order.payment_status ?? null,
    productIds: itemsByOrder.get(order.id) ?? [],
  }));
}
