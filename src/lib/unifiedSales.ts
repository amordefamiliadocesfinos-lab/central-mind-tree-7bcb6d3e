import { supabase } from '@/integrations/supabase/client';
import { resolvePhysicalIdentity } from '@/lib/products/physicalIdentity';
import { refreshCrmLiveContext } from '@/lib/crm/liveContext';
import { executeExternalCrmFact } from '@/lib/crm/externalFactExecutor';
import type { OperationalDestination } from '@/lib/orders/operationalDestination';

export type SalePaymentStatus = 'pendente' | 'pago' | 'parcial';

export interface UnifiedSaleItem {
  product_id: string;
  variant_id?: string | null;
  /** Always physical/canonical. Commercial entry is kept separately below. */
  quantity: number;
  /** Price per commercial unit (or physical unit for direct/legacy entries). */
  unit_price: number;
  notes?: string | null;
  commercial_presentation_id?: string | null;
  commercial_presentation_name?: string | null;
  commercial_unit_label?: string | null;
  commercial_conversion_factor?: number | null;
  commercial_quantity?: number | null;
  physical_unit_label?: string | null;
}

export interface UnifiedSaleInput {
  order_number?: string | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  contact_id?: string | null;
  channel?: string;
  order_type?: 'stock' | 'production';
  order_date?: string;
  delivery_date?: string | null;
  financial_due_date?: string | null;
  notes?: string | null;
  discount_amount?: number;
  shipping_amount?: number;
  payment_status?: SalePaymentStatus;
  payment_method?: string | null;
  financial_account_id?: string | null;
  payment_date?: string | null;
  marketplace_account?: string | null;
  channel_account_id?: string | null;
  /** Identifica a origem sem criar uma segunda entidade de Venda. */
  sale_origin?: string | null;
  /** Chave opcional para retries/dobro clique do mesmo comando comercial. */
  sale_request_key?: string | null;
  /** Quando a venda nasce no CRM, produz o fato canônico Pedido confirmado. */
  crm_order_confirmed?: boolean;
  /** Destino operacional canônico do pedido, separado do status comercial. */
  operational_destination?: OperationalDestination | null;
  logistics_mode?: string | null;
  operational_destination_details?: Record<string, unknown> | null;
}

export interface UnifiedSaleResult {
  order_id: string;
  order_number: string;
  financial_entry_id: string;
  total_value: number;
  already_registered?: boolean;
}

async function emitCrmSaleFacts(order: UnifiedSaleInput, result: UnifiedSaleResult) {
  if (!order.contact_id || result.already_registered) return;

  const occurredAt = new Date().toISOString();
  const commonMetadata = {
    orderId: result.order_id,
    orderNumber: result.order_number,
    financialEntryId: result.financial_entry_id,
    saleOrigin: order.sale_origin || 'operacoes',
  };

  if (order.crm_order_confirmed) {
    const orderFact = await executeExternalCrmFact({
      source: 'frontend',
      eventType: 'order_confirmed',
      timestamp: occurredAt,
      contactId: order.contact_id,
      externalId: result.order_id,
      metadata: commonMetadata,
    });
    if (orderFact.status !== 'applied') {
      console.warn('F6-J: order_confirmed não materializado no CRM', orderFact);
    }
  }

  if (order.payment_status === 'pago') {
    const paymentFact = await executeExternalCrmFact({
      source: 'frontend',
      eventType: 'payment_confirmed',
      timestamp: occurredAt,
      contactId: order.contact_id,
      externalId: `financial-entry:${result.financial_entry_id}:paid`,
      metadata: {
        ...commonMetadata,
        paymentDate: order.payment_date || occurredAt.slice(0, 10),
        amount: result.total_value,
      },
    });
    if (paymentFact.status !== 'applied') {
      console.warn('F6-I: payment_confirmed da venda unificada não materializado no CRM', paymentFact);
    }
  }
}

export async function createUnifiedSale(order: UnifiedSaleInput, items: UnifiedSaleItem[]) {
  const validItems = items.filter(item => item.product_id && item.quantity > 0);
  if (!validItems.length) throw new Error('Adicione ao menos um produto à venda.');
  await Promise.all(validItems.map(item => resolvePhysicalIdentity(item.product_id, item.variant_id)));

  const { data, error } = await (supabase.rpc as any)('create_unified_sale', {
    p_order: {
      ...order,
      delivery_date: order.delivery_date || null,
      financial_due_date: order.financial_due_date || new Date().toISOString().slice(0, 10),
      payment_status: order.payment_status || 'pendente',
    },
    p_items: validItems,
  });
  if (error) throw error;
  const result = data as UnifiedSaleResult;

  try {
    await emitCrmSaleFacts(order, result);
  } catch (factError) {
    // A venda já foi confirmada transacionalmente. Não fabricar rollback lógico.
    // O erro fica explícito para observação/reprocessamento sem reintroduzir writer paralelo no banco.
    console.error('Não foi possível materializar fato CRM da venda unificada', factError);
  }

  if (order.contact_id) {
    refreshCrmLiveContext({
      contactId: order.contact_id,
      type: order.payment_status === 'pago' ? 'payment' : 'sale',
      occurredAt: new Date().toISOString(),
      summary: order.payment_status === 'pago' ? 'Pagamento de venda confirmado.' : 'Nova venda registrada.',
      memory: {
        purchase_pattern: {
          last_purchase_at: order.order_date || new Date().toISOString(),
          recurring_product_ids: validItems.map((item) => item.product_id),
        },
      },
    });
  }
  return result;
}
