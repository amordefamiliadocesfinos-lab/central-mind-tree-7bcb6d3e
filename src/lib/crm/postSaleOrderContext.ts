import type { CrmResultCode } from '@/lib/crm/canonical/types';

const STORAGE_KEY = 'crm-post-sale-order-context';
const POST_SALE_RESULTS = new Set<CrmResultCode>([
  'CRM-RES-023',
  'CRM-RES-024',
  'CRM-RES-025',
  'CRM-RES-026',
  'CRM-RES-027',
  'CRM-RES-028',
  'CRM-RES-029',
]);

export interface PostSaleOrderContext {
  contactId: string;
  conversationId: string;
  orderId: string;
}

export function isPostSaleResultCode(resultCode: CrmResultCode): boolean {
  return POST_SALE_RESULTS.has(resultCode);
}

export function setPostSaleOrderContext(context: PostSaleOrderContext) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export function clearPostSaleOrderContext() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getMatchingPostSaleOrderContext(input: {
  contactId: string;
  conversationId: string;
  resultCode: CrmResultCode;
}): PostSaleOrderContext | null {
  if (!isPostSaleResultCode(input.resultCode) || typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PostSaleOrderContext>;
    if (
      typeof parsed.contactId !== 'string' ||
      typeof parsed.conversationId !== 'string' ||
      typeof parsed.orderId !== 'string' ||
      !parsed.orderId.trim()
    ) return null;

    if (parsed.contactId !== input.contactId || parsed.conversationId !== input.conversationId) return null;
    return {
      contactId: parsed.contactId,
      conversationId: parsed.conversationId,
      orderId: parsed.orderId,
    };
  } catch {
    return null;
  }
}
