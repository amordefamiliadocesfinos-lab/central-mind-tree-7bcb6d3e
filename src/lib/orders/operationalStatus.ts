import { supabase } from '@/integrations/supabase/client';

/**
 * FASE 1 — Verdade operacional do Pedido.
 * Dimensão simples e autônoma, independente do `orders.status` legado.
 */
export type OrderOperationalStatus = 'todo' | 'preparing' | 'finalized' | 'cancelled';

export const ORDER_OPERATIONAL_STATUS: Record<OrderOperationalStatus, { label: string; color: string; border: string; order: number }> = {
  todo: { label: 'A FAZER', color: 'bg-slate-500', border: 'border-l-slate-400', order: 0 },
  preparing: { label: 'EM PREPARAÇÃO', color: 'bg-amber-500', border: 'border-l-amber-500', order: 1 },
  finalized: { label: 'FINALIZADO', color: 'bg-emerald-600', border: 'border-l-emerald-500', order: 2 },
  cancelled: { label: 'CANCELADO', color: 'bg-gray-400', border: 'border-l-gray-400', order: 3 },
};

export const ORDER_OPERATIONAL_STATUS_LIST = (Object.keys(ORDER_OPERATIONAL_STATUS) as OrderOperationalStatus[])
  .map(key => ({ key, label: ORDER_OPERATIONAL_STATUS[key].label }));

export function getOperationalStatus(order: { operational_status?: string | null }): OrderOperationalStatus {
  const value = order.operational_status;
  return value && value in ORDER_OPERATIONAL_STATUS ? (value as OrderOperationalStatus) : 'todo';
}

/**
 * A Central de Separação continua exibindo finalizados como histórico, mas um
 * cancelamento operacional nunca pode permanecer no fluxo físico. O status
 * legado fica apenas como compatibilidade para registros anteriores à Fase 1.
 */
export function isSeparationEligible(order: { operational_status?: string | null; status?: string | null }): boolean {
  return order.operational_status !== 'cancelled' && order.status !== 'cancelado';
}

/** Transições manuais sem efeito de estoque (todo/preparing/cancelled). */
export async function setOrderOperationalStatus(orderId: string, status: Exclude<OrderOperationalStatus, 'finalized'>) {
  const { data, error } = await (supabase.rpc as any)('set_order_operational_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
  return data as { order_id: string; operational_status: OrderOperationalStatus };
}

/**
 * FINALIZADO usa exatamente o mesmo caminho da Separação: a baixa física
 * continua sendo feita apenas por `apply_order_stock_event(..., 'shipped')`.
 */
export async function finalizeOrderOperational(orderId: string) {
  const { data, error } = await (supabase.rpc as any)('finalize_order_separation', {
    p_order_id: orderId,
  });
  if (error) throw error;
  return data as { already_finalized: boolean; stock_result: { already_applied?: boolean; movement_count?: number } | null };
}

/** Mensagem compreensível para falhas de estoque na finalização. */
export function describeFinalizationError(error: unknown): string {
  const message = (error as { message?: string })?.message ?? '';
  if (/estoque|saldo|insufficient|negativ/i.test(message)) {
    return `Não foi possível finalizar: o estoque não cobre os itens deste pedido. Detalhe: ${message}`;
  }
  return message ? `Não foi possível finalizar o pedido. Detalhe: ${message}` : 'Não foi possível finalizar o pedido.';
}
