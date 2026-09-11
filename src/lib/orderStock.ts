import { supabase } from '@/integrations/supabase/client';
import { type OrderStockEvent } from './orderStockContract';

export { getOrderStockEventForStatus, getOrderStockEventKey, getPhysicalStockEvent } from './orderStockContract';

export interface OrderStockEventResult {
  event: OrderStockEvent;
  applied: boolean;
  already_applied: boolean;
  movement_count: number;
}

/**
 * Ponto único para futuras origens (manual, CRM, Shopee, Mercado Livre).
 * A execução efetiva fica no banco para manter saldo, rastreabilidade e
 * idempotência consistentes mesmo com requisições repetidas.
 */
export async function applyOrderStockEvent(
  orderId: string,
  event: OrderStockEvent,
): Promise<OrderStockEventResult> {
  const { data, error } = await (supabase.rpc as any)('apply_order_stock_event', {
    p_order_id: orderId,
    p_event: event,
  });

  if (error) throw error;
  return data as OrderStockEventResult;
}

/** Atualiza o pedido e aplica a eventual consequência de estoque atomicamente. */
export async function transitionOrderStatusWithStock(orderId: string, status: string) {
  const { data, error } = await (supabase.rpc as any)('transition_order_status_with_stock', {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) throw error;
  return data as { stock_event: OrderStockEvent | null; movement_count: number };
}

/**
 * Finalização operacional canônica, compartilhada por Pedido e Separação.
 * A RPC concentra a baixa física idempotente e a sincronização operacional.
 */
export async function finalizeOrderSeparation(orderId: string) {
  const { data, error } = await (supabase.rpc as any)('finalize_order_separation', {
    p_order_id: orderId,
  });

  if (error) throw error;
  return data as {
    already_finalized: boolean;
    stock_result: OrderStockEventResult | null;
  };
}
