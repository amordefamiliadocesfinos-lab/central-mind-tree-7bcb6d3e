import { ORDER_CHANNELS } from '@/stores/appStore';
import { salesChannelLabel } from '@/lib/salesChannels';

interface OrderIdentity {
  id: string;
  order_number?: string | null;
  internal_order_number?: string | null;
  customer_name?: string | null;
  channel?: string | null;
  marketplace_account?: string | null;
}

export function getOrderReference(
  order: Pick<OrderIdentity, 'id' | 'order_number' | 'internal_order_number'>,
): string {
  // O número interno (PED-00001) é a identidade humana; `order_number`
  // permanece intacto como referência externa/marketplace.
  const internal = order.internal_order_number?.trim();
  if (internal) return internal;
  const orderNumber = order.order_number?.trim();
  return orderNumber || `#${order.id.slice(0, 6)}`;
}

const MASKED_NAME_PATTERN = /\*/;

function isMaskedOrPlaceholderName(name: string): boolean {
  // Marketplaces mask buyer names with asterisks, making them useless as a main title.
  return MASKED_NAME_PATTERN.test(name);
}

function getChannelLabel(channel?: string | null): string {
  if (!channel) return 'Pedido';
  const salesLabel = salesChannelLabel(channel);
  if (salesLabel !== channel) return salesLabel;
  return ORDER_CHANNELS[channel as keyof typeof ORDER_CHANNELS] || channel;
}

function getOperationalIdentifier(order: OrderIdentity): string {
  const channelLabel = getChannelLabel(order.channel);
  const store = order.marketplace_account?.trim();
  let prefix = channelLabel;

  if (store) {
    const lowerStore = store.toLowerCase();
    const lowerChannel = channelLabel.toLowerCase();
    // Avoid repeating the channel name when the account already includes it (e.g. "Shopee Priscila").
    if (lowerStore.startsWith(lowerChannel) || lowerChannel.startsWith(lowerStore)) {
      prefix = store;
    } else {
      prefix = `${channelLabel} ${store}`;
    }
  }

  return `${prefix} · ${getOrderReference(order)}`;
}

/**
 * Identifica a origem operacional sem substituir a identidade do cliente.
 * A conta Shopee é canônica em `marketplace_account` e pode já conter o
 * prefixo do canal; nesse caso ele não é repetido.
 */
export function getOrderOperationalOrigin(order: OrderIdentity): string | null {
  const store = order.marketplace_account?.trim();
  if (!store) return null;

  const channelLabel = getChannelLabel(order.channel);
  const normalizedStore = store.toLocaleLowerCase();
  const normalizedChannel = channelLabel.toLocaleLowerCase();
  return normalizedStore.startsWith(normalizedChannel)
    ? store
    : `${channelLabel} ${store}`;
}

export function getOrderCustomerName(order: OrderIdentity): string {
  const name = order.customer_name?.trim();
  if (name && !isMaskedOrPlaceholderName(name)) {
    return name;
  }
  return getOperationalIdentifier(order);
}

type PaymentStatus = 'pendente' | 'pago' | 'parcial' | null | undefined;

export function getOrderPaymentPresentation(status: PaymentStatus) {
  if (status === 'pago') return { label: 'PAGO', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' };
  if (status === 'parcial') return { label: 'PARCIAL', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700' };
  return { label: 'PENDENTE', className: 'border-rose-500/30 bg-rose-500/10 text-rose-700' };
}
