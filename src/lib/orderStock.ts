import { supabase } from '@/integrations/supabase/client';
import { type OrderStockEvent } from './orderStockContract';

export { getOrderStockEventForStatus, getOrderStockEventKey, getPhysicalStockEvent } from './orderStockContract';

export interface OrderStockEventResult {
  event: OrderStockEvent;
  applied: boolean;
  already_applied: boolean;
  movement_count: number;
}

export interface OrderStockShortage { product_id: string; variant_id: string | null; product_name?: string; variant_name?: string | null; required_quantity: number; available_quantity: number; missing_quantity: number; }
export class OrderStockShortageError extends Error {
  constructor(message: string, public readonly shortages: OrderStockShortage[]) { super(message); this.name = 'OrderStockShortageError'; }
}
function throwStructuredShortage(error: any): never {
  try {
    const detail = typeof error?.details === 'string' ? JSON.parse(error.details) : error?.details;
    const shortages = Array.isArray(detail) ? detail : detail ? [detail] : [];
    if (shortages.length && shortages.every(item => item && typeof item.missing_quantity !== 'undefined')) throw new OrderStockShortageError(error.message || 'Estoque insuficiente para finalizar.', shortages);
  } catch (caught) { if (caught instanceof OrderStockShortageError) throw caught; }
  throw error;
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

  if (error) throwStructuredShortage(error);
  return data as OrderStockEventResult;
}

/** Atualiza o pedido e aplica a eventual consequência de estoque atomicamente. */
export async function transitionOrderStatusWithStock(orderId: string, status: string) {
  const { data, error } = await (supabase.rpc as any)('transition_order_status_with_stock', {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) throwStructuredShortage(error);
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

  if (error) throwStructuredShortage(error);
  return data as {
    already_finalized: boolean;
    stock_result: OrderStockEventResult | null;
  };
}
