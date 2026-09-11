import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToRoutineButton } from '@/components/routine/AddToRoutineButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Trash2, Package, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { OrderPriorityBadge } from './OrderPriorityBadge';
import { LateProductionBadge } from './LateProductionBadge';
import { getOrderCustomerName, getOrderReference } from './orderPresentation';
import { ORDER_OPERATIONAL_STATUS, ORDER_OPERATIONAL_STATUS_LIST, getOperationalStatus } from '@/lib/orders/operationalStatus';

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};

interface OrderItem {
  quantity: number;
  product?: { name: string };
  variant?: { variant_name: string } | null;
}

interface Order {
  id: string;
  order_number?: string | null;
  internal_order_number?: string | null;
  operational_status?: string | null;
  customer_name?: string | null;
  status: string;
  channel?: string | null;
  order_date: string;
  due_date?: string | null;
  total_value?: number | null;
  order_type?: 'stock' | 'production';
  items?: OrderItem[];
}

interface OrderCardProps {
  order: Order;
  /** Catálogo legado — mantido apenas por compatibilidade nesta fase. */
  orderStatus?: Record<string, { label: string; color: string }>;
  orderChannels: Record<string, string>;
  onStatusChange: (order: Order, newStatus: string) => void;
  onDelete?: (orderId: string) => void;
  onClick?: (order: Order) => void;
}

export function OrderCard({ order, orderStatus, orderChannels, onStatusChange, onDelete, onClick }: OrderCardProps) {
  const operationalStatus = getOperationalStatus(order);
  const statusInfo = ORDER_OPERATIONAL_STATUS[operationalStatus];
  const isStockOrder = order.order_type === 'stock';
  const customerName = getOrderCustomerName(order);
  const orderReference = getOrderReference(order);
  const channelLabel = order.channel ? orderChannels[order.channel] : undefined;

  return (
    <Card
      className="touch-manipulation active:scale-[0.99] transition-transform cursor-pointer hover:bg-muted/50"
      onClick={() => onClick?.(order)}
    >
      <CardContent className="p-3 md:p-4">
        {/* Header row: customer + price */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-sm md:text-base truncate">{customerName}</h3>
              <Badge className={cn('text-[10px] md:text-xs px-1.5 py-0', statusInfo?.color)}>
                {statusInfo.label}
              </Badge>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] md:text-xs',
                  isStockOrder ? 'text-emerald-600' : 'text-amber-600'
                )}
                title={isStockOrder ? 'Venda de estoque' : 'Produção sob demanda'}
              >
                {isStockOrder ? <Package className="h-3 w-3" /> : <Factory className="h-3 w-3" />}
                <span className="hidden sm:inline">{isStockOrder ? 'Estoque' : 'Produção'}</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
              Pedido {orderReference}{channelLabel ? ` · ${channelLabel}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-base md:text-lg leading-tight">
              R$ {(order.total_value || 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">{formatDate(order.order_date)}</p>
          </div>
        </div>

        {/* Priority badges row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <OrderPriorityBadge dueDate={order.due_date} />
          <LateProductionBadge dueDate={order.due_date} status={order.status} />
          {order.due_date && (
            <span className="text-[11px] text-amber-600 font-medium">
              Entrega: {formatDate(order.due_date)}
            </span>
          )}
        </div>

        {/* Items preview */}
        {order.items && order.items.length > 0 && (
          <p className="text-[11px] md:text-xs text-muted-foreground line-clamp-2 mb-2">
            {order.items.map(item =>
              `${item.quantity}x ${item.product?.name || 'Produto'}${item.variant?.variant_name ? ` · ${item.variant.variant_name}` : ''}`
            ).join(', ')}
          </p>
        )}

        {/* Status selector — full width on mobile, inline on desktop */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground shrink-0">Status:</span>
          <Select
            value={operationalStatus}
            onValueChange={(v) => onStatusChange(order, v)}
          >
            <SelectTrigger
              className="flex-1 h-9 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_OPERATIONAL_STATUS_LIST.map(({ key, label }) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div onClick={(e) => e.stopPropagation()}>
            <AddToRoutineButton
              iconOnly
              variant="ghost"
              source={{ kind: 'operations/order', id: order.id, label: order.order_number || undefined }}
              defaultTitle={`📦 Pedido ${order.order_number || ''}`}
              defaultFocus="trabalho_profundo"
              defaultDurationMin={30}
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
