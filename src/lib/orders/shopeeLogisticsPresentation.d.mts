export type ShopeeLogisticsState = 'AGUARDANDO_ORGANIZACAO' | 'ENVIO_JA_ORGANIZADO' | 'EXPEDIDO' | 'BLOQUEADO' | 'INDETERMINADO';
export interface ShopeeLogisticsSelection {
  ok: boolean;
  account: string;
  selected: Array<{ order_sn: string; state: ShopeeLogisticsState; reason?: string | null;
    auto_arrangement_authorized: false; create_shipping_document_authorized: false;
    inventory_mutation_authorized: false }>;
}
export declare const SHOPEE_LOGISTICS_PRESENTATION: Record<ShopeeLogisticsState, {label:string;tone:string}>;
export declare function presentShopeeLogistics(selection: ShopeeLogisticsSelection | null | undefined,
  orderSn: string | null | undefined, channelAccountId: string | null | undefined):
  { label:string; tone:string; state:ShopeeLogisticsState; reason:string|null;
    canArrange:false;canCreateDocument:false;canMutateInventory:false } | null;
