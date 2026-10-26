import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ShopeeLogisticsSelection } from '@/lib/orders/shopeeLogisticsPresentation.mjs';
import type { Order } from '@/hooks/useOrders';

const ADAO = 'b4027369-5abf-4ac1-ab24-862334fae892';
type Row = { channel_account_id: string; order_sn: string; state: string; reason: string | null; observed_at: string };
const STATES = new Set(['AGUARDANDO_ORGANIZACAO','ENVIO_JA_ORGANIZADO','EXPEDIDO','BLOQUEADO','INDETERMINADO']);
export function useShopeeLogisticsReadState(orders: Order[]): ShopeeLogisticsSelection | null {
  const orderSns = useMemo(() => [...new Set(orders.filter(o => o.channel_account_id === ADAO
    && o.sale_origin === 'shopee_open_platform' && o.order_number).map(o => o.order_number as string))].sort(), [orders]);
  const [selection, setSelection] = useState<ShopeeLogisticsSelection | null>(null);
  useEffect(() => {
    let active = true;
    setSelection(null);
    if (!orderSns.length) return () => { active = false; };
    void (async () => {
      const { data, error } = await supabase.from('shopee_logistics_read_state' as never)
        .select('channel_account_id,order_sn,state,reason,observed_at')
        .eq('channel_account_id', ADAO)
        .in('order_sn', orderSns.slice(0, 100));
      if (!active || error || !Array.isArray(data)) return;
      const rows = data as Row[];
      const selected = rows.filter(row => row.channel_account_id === ADAO && orderSns.includes(row.order_sn)
        && STATES.has(row.state) && Number.isFinite(Date.parse(row.observed_at)))
        .map(row => ({ order_sn: row.order_sn,
          state: row.state as ShopeeLogisticsSelection['selected'][number]['state'],
          reason: row.reason, auto_arrangement_authorized: false as const,
          create_shipping_document_authorized: false as const,
          inventory_mutation_authorized: false as const }));
      if (active) setSelection({ ok: true, account: 'adao', selected });
    })();
    return () => { active = false; };
  }, [orderSns.join('|')]);
  return selection;
}
