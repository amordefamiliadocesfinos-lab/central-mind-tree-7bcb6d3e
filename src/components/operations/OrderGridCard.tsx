import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { OrderPriorityBadge } from './OrderPriorityBadge';
import { LateProductionBadge } from './LateProductionBadge';
import { getOrderCustomerName, getOrderReference } from './orderPresentation';

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
  customer_name?: string | null;
  status: string;
  channel?: string | null;
  order_date: string;
  due_date?: string | null;
  total_value?: number | null;
  order_type?: 'stock' | 'production';
  items?: OrderItem[];
}

interface OrderGridCardProps {
  order: Order;
  orderStatus: Record<string, { label: string; color: string }>;
  orderChannels: Record<string, string>;
  onStatusChange: (order: Order, newStatus: string) => void;
  onClick?: (order: Order) => void;
}

const STATUS_BORDER_COLORS: Record<string, string> = {
  pendente: 'border-l-yellow-400',
  producao: 'border-l-amber-500',
  produzido: 'border-l-emerald-500',
  enviado: 'border-l-blue-500',
  faturado: 'border-l-indigo-500',
  entregue: 'border-l-teal-500',
  concluido: 'border-l-green-500',
  cancelado: 'border-l-red-500',
};

export function OrderGridCard({ order, orderStatus, orderChannels, onStatusChange, onClick }: OrderGridCardProps) {
  const statusInfo = orderStatus[order.status as keyof typeof orderStatus];
  const isStockOrder = order.order_type === 'stock';
  const borderColor = STATUS_BORDER_COLORS[order.status] || 'border-l-muted';
  const customerName = getOrderCustomerName(order);
  const orderReference = getOrderReference(order);
  const channelLabel = order.channel ? orderChannels[order.channel] : undefined;

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all border-l-4',
        borderColor
      )}
      onClick={() => onClick?.(order)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Line 1 - Customer */}
        <h3 className="font-semibold text-base truncate">
          {customerName}
        </h3>

        {/* Line 2 - Status + type (consolidated) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={cn('text-xs', statusInfo?.color)}>
            {statusInfo?.label || order.status}
          </Badge>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px]',
              isStockOrder ? 'text-emerald-600' : 'text-amber-600'
            )}
          >
            {isStockOrder ? <Package className="h-3 w-3" /> : <Factory className="h-3 w-3" />}
            {isStockOrder ? 'Estoque' : 'Produção'}
          </span>
        </div>

        {/* Line 3 - Fixed order reference + useful context */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p><span className="font-medium">Pedido:</span> {orderReference}</p>
          <p>
            {channelLabel && <><span className="font-medium">Canal:</span> {channelLabel} · </>}
            {formatDate(order.order_date)}
          </p>
          {order.due_date && (
            <div className="flex items-center gap-1.5">
              <span><span className="font-medium text-amber-600">Entrega:</span> {formatDate(order.due_date)}</span>
              <OrderPriorityBadge dueDate={order.due_date} />
              <LateProductionBadge dueDate={order.due_date} status={order.status} />
            </div>
          )}
        </div>

        {/* Line 4 - Products */}
        {order.items && order.items.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {order.items.map(item =>
              `${item.quantity}x ${item.product?.name || 'Produto'}${item.variant?.variant_name ? ` · ${item.variant.variant_name}` : ''}`
            ).join(', ')}
          </p>
        )}

        {/* Line 5 - Value */}
        <p className="text-xl font-bold">
          R$ {(order.total_value || 0).toFixed(2)}
        </p>

        {/* Line 6 - Action */}
        <Select
          value={order.status}
          onValueChange={(v) => onStatusChange(order, v)}
        >
          <SelectTrigger className="w-full h-9 text-xs" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(orderStatus).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
